const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Fail fast, not silently insecure: a missing JWT_SECRET must stop the
// service from starting at all, never fall back to a secret that's public
// in this repository's git history.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with an insecure default.');
  process.exit(1);
}

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Register plugins
fastify.register(require('@fastify/jwt'), { secret: process.env.JWT_SECRET });
fastify.register(require('@fastify/rate-limit'), {
  max: 120,
  timeWindow: '1 minute',
});
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});
fastify.register(require('@fastify/static'), {
  root: UPLOAD_DIR,
  prefix: '/api/v1/messages/uploads/',
});

// Every route below (except /health) requires a valid JWT. Identity for a
// send/read always comes from the verified token, never from the request
// body or query string — the client cannot claim to be another user.
const bearerAuth = async (request, reply) => {
  try {
    await request.jwtVerify();
    if (!request.user.tenantId) return reply.code(403).send({ error: 'No tenant scope' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

// Send/read access to a room requires actual membership — not just a guessed
// or known UUID. Used by both the HTTP routes and the socket layer so the
// same rule applies everywhere a client can touch a room's messages.
async function isRoomMember(groupId, userId) {
  if (!groupId || !userId) return false;
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return !!member;
}

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'messaging-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});
const producer = kafka.producer();

// Module-level io reference — assigned inside start() after server listens
let io = null;

// "Delivered" (double grey tick) means at least one other socket is already
// in the room when the message broadcasts — i.e. a recipient has the chat
// open on their device. This isn't per-recipient tracking, but it matches
// what the UI actually renders: one status per message, not one per member.
function broadcastDelivered(roomId, messageId) {
  if (!io) return;
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room && room.size > 1) {
    io.to(roomId).emit('message_delivered', { roomId, messageId });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A quote can name a message that never existed (client still holding a
// temporary local id) or one since deleted — both would fail the FK and reject
// the whole send. Confining the lookup to this group also stops a message from
// quoting one in another room. Dropping the quote beats losing the message.
async function resolveReplyToId(rawId, groupId) {
  if (typeof rawId !== 'string' || !UUID_RE.test(rawId)) return null;
  const found = await prisma.message.findFirst({
    where: { id: rawId, groupId },
    select: { id: true },
  });
  return found ? rawId : null;
}

// Shape a quoted message for clients. Media quotes carry no preview text, so the
// client renders a label from `type` rather than showing a raw upload URL.
function serializeReplyTo(replyTo) {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    content: replyTo.content,
    senderId: replyTo.senderId,
    senderName: replyTo.sender?.fullName ?? 'Unknown',
    type: replyTo.type ?? 'text',
  };
}

fastify.get('/api/v1/messages/health', async (request, reply) => {
  return { status: 'ok', service: 'messaging-service' };
});

/**
 * Upload a media attachment and broadcast it as a message
 * Accepts multipart/form-data with a file. Sender identity comes from the JWT.
 */
fastify.post('/api/v1/messages/:groupId/media', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId } = request.params;
  const { userId: senderId, tenantId } = request.user;

  if (!(await isRoomMember(groupId, senderId))) {
    return reply.code(403).send({ error: 'Not a member of this room' });
  }

  // Parse multipart fields + file
  const parts = request.parts();
  let savedPath = null;
  let originalName = 'file';
  let mimeType = 'application/octet-stream';
  let filename = null;

  for await (const part of parts) {
    if (part.file) {
      // Determine extension from original filename
      const ext = path.extname(part.filename || '').toLowerCase() || '.bin';
      const uuid = crypto.randomUUID();
      filename = `${uuid}${ext}`;
      savedPath = path.join(UPLOAD_DIR, filename);
      originalName = part.filename || filename;
      mimeType = part.mimetype || mimeType;

      const writeStream = fs.createWriteStream(savedPath);
      await new Promise((resolve, reject) => {
        part.file.pipe(writeStream);
        part.file.on('end', resolve);
        part.file.on('error', reject);
      });
    }
  }

  if (!savedPath) {
    return reply.code(400).send({ error: 'file is required' });
  }

  const messageId = crypto.randomUUID();
  const now = new Date();

  const isVideo = mimeType.startsWith('video/');
  const msgType = isVideo ? 'video' : 'image';

  // Relative URL — nginx routes /api/v1/messages/* to messaging_service
  const fileUrl = `/api/v1/messages/uploads/${filename}`;

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true, avatarUrl: true },
  });

  try {
    await prisma.message.create({
      data: { id: messageId, tenantId, groupId, senderId, content: fileUrl, type: msgType, createdAt: now },
    });
  } catch (err) {
    fastify.log.error(`Failed to persist media message: ${err.message}`);
    return reply.code(500).send({ error: 'Failed to save message' });
  }

  const payload = {
    id: messageId,
    roomId: groupId,
    content: fileUrl,
    senderId,
    senderName: sender?.fullName ?? 'Unknown',
    senderAvatar: sender?.avatarUrl ?? null,
    tenantId,
    timestamp: now.toISOString(),
    type: msgType,
    originalName,
  };

  if (io) io.to(groupId).emit('new_message', payload);
  broadcastDelivered(groupId, messageId);

  fastify.log.info(`[MEDIA] ${msgType} saved in room ${groupId} by ${senderId}`);
  return reply.code(201).send({ message: payload });
});

/**
 * Send a Message (HTTP — reliable alternative to socket emit)
 */
fastify.post('/api/v1/messages/:groupId', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId } = request.params;
  const { userId: senderId, tenantId } = request.user;
  const { content, replyToId } = request.body || {};

  if (!content) {
    return reply.code(400).send({ error: 'content is required' });
  }

  if (!(await isRoomMember(groupId, senderId))) {
    return reply.code(403).send({ error: 'Not a member of this room' });
  }

  const messageId = crypto.randomUUID();
  const now = new Date();

  const resolvedReplyToId = await resolveReplyToId(replyToId, groupId);
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } });

  let saved;
  try {
    saved = await prisma.message.create({
      data: { id: messageId, tenantId, groupId, senderId, content, replyToId: resolvedReplyToId, createdAt: now },
      include: { replyTo: { include: { sender: { select: { fullName: true } } } } },
    });
  } catch (err) {
    fastify.log.error(`Failed to persist message (HTTP): ${err.message}`);
    return reply.code(500).send({ error: 'Failed to save message' });
  }

  const payload = {
    id: messageId, roomId: groupId, content, senderId, senderName: sender?.fullName ?? 'Unknown',
    tenantId, replyToId: resolvedReplyToId, timestamp: now.toISOString(),
    type: 'text',
    replyTo: serializeReplyTo(saved.replyTo),
  };

  if (io) io.to(groupId).emit('new_message', payload);
  broadcastDelivered(groupId, messageId);

  fastify.log.info(`Message saved (HTTP) in room ${groupId} by ${senderId}`);
  return reply.code(201).send({ message: payload });
});

/**
 * Get Message History for a Group
 */
fastify.get('/api/v1/messages/:groupId', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId } = request.params;
  const { userId } = request.user;
  const { limit = '60', before } = request.query || {};

  if (!(await isRoomMember(groupId, userId))) {
    return reply.code(403).send({ error: 'Not a member of this room' });
  }

  const messages = await prisma.message.findMany({
    where: {
      groupId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(parseInt(limit) || 60, 200),
    include: {
      sender: { select: { fullName: true, avatarUrl: true } },
      replyTo: { include: { sender: { select: { fullName: true } } } },
    },
  });

  // Real per-message read status on reload, not a guess: the client can only
  // tell "read" from "delivered" for its own past messages by comparing each
  // timestamp against how far the other side has actually read up to.
  // Approximated as the *latest* lastReadAt among everyone else in the room —
  // exact for a DM (one other member), an over-generous approximation for a
  // group (flips blue once the first other member has read that far).
  const others = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: userId } },
    select: { lastReadAt: true },
  });
  const timestamps = others.map(o => o.lastReadAt).filter(Boolean).map(d => d.getTime());
  const otherReadAt = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;

  return {
    messages: messages.map(m => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderName: m.sender?.fullName ?? 'Unknown',
      senderAvatar: m.sender?.avatarUrl ?? null,
      timestamp: m.createdAt.toISOString(),
      type: m.type ?? 'text',
      replyToId: m.replyToId ?? null,
      replyTo: serializeReplyTo(m.replyTo),
    })),
    otherReadAt,
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3002, host: '0.0.0.0' });

    // Attach Socket.IO (assign to module-level var so HTTP handlers can broadcast)
    // Shorter ping cycle than the engine.io default (25s interval/20s timeout,
    // ~45s worst case): mobile networks silently drop idle sockets without a
    // FIN, and the client only notices — and reconnects — on a missed pong.
    // A tighter cycle bounds that "stuck until reconnect" window.
    io = new Server(fastify.server, {
      cors: { origin: '*' },
      pingInterval: 10000,
      pingTimeout: 8000,
    });

    // Every socket must present a valid JWT before it's allowed to connect at
    // all — the client sends it as `auth: { token }` (works identically over
    // websocket and polling, unlike an HTTP header which browsers can drop on
    // the websocket upgrade). Identity derived here is what every handler
    // below trusts; nothing from the client payload overrides it.
    io.use((socket, next) => {
      try {
        const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        const token = typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : raw;
        if (!token) return next(new Error('unauthorized'));
        const payload = fastify.jwt.verify(token);
        if (!payload.tenantId) return next(new Error('unauthorized'));
        socket.data.userId = payload.userId;
        socket.data.tenantId = payload.tenantId;
        next();
      } catch (err) {
        next(new Error('unauthorized'));
      }
    });

    await producer.connect();

    io.on('connection', (socket) => {
      fastify.log.info(`User ${socket.data.userId} connected: ${socket.id}`);

      // Join a room — only if the verified user is actually a member of it.
      // Without this check any authenticated socket could join any room by
      // guessing its UUID and read every message broadcast to it.
      socket.on('join_room', async (roomId) => {
        if (typeof roomId !== 'string') return;
        if (!(await isRoomMember(roomId, socket.data.userId))) {
          socket.emit('join_room_denied', { roomId });
          fastify.log.warn(`User ${socket.data.userId} denied join to room ${roomId}`);
          return;
        }
        socket.join(roomId);
        fastify.log.info(`User ${socket.data.userId} joined room: ${roomId}`);

        // broadcastDelivered() only checks room membership at the instant a
        // message is sent — if the recipient's socket wasn't joined yet
        // (reconnecting, app still starting up), that message is stuck on a
        // single grey tick forever with nothing to re-check it later. This
        // join is exactly the moment to self-heal: tell whoever's already in
        // the room that someone new is here, so their open chat screen can
        // promote any of its own still-"sent" messages to delivered.
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size > 1) {
          socket.to(roomId).emit('room_active', { roomId });
        }
      });

      // A client emits this the moment its chat screen for roomId is open
      // and showing messages. Relayed to everyone else in the room (not
      // back to the reader) so the sender's ticks flip to blue live —
      // socket.to() excludes the emitting socket, unlike io.to(). userId is
      // always the verified identity, never whatever the client sent.
      socket.on('room_read', ({ roomId } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        socket.to(roomId).emit('peer_read', { roomId, userId: socket.data.userId });
      });

      // Handle New Message (socket path — not currently used by the shipped
      // client, which sends via HTTP, but held to the same identity/
      // membership rules as the HTTP route for when it is).
      socket.on('send_message', async ({ roomId, content, replyToId } = {}) => {
        if (!roomId || !content) return;
        if (!(await isRoomMember(roomId, socket.data.userId))) return;

        const senderId = socket.data.userId;
        const tenantId = socket.data.tenantId;
        const messageId = crypto.randomUUID();
        const now = new Date();

        const resolvedReplyToId = await resolveReplyToId(replyToId, roomId);
        const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } });

        const messagePayload = {
          id: messageId,
          roomId,
          content,
          senderId,
          senderName: sender?.fullName ?? 'Unknown',
          tenantId,
          replyToId: resolvedReplyToId,
          timestamp: now.toISOString(),
        };

        try {
          await prisma.message.create({
            data: {
              id: messageId,
              tenantId,
              groupId: roomId,
              senderId,
              content,
              replyToId: resolvedReplyToId,
              createdAt: now,
            },
          });
        } catch (err) {
          fastify.log.error(`Failed to persist message: ${err.message}`);
          return;
        }

        io.to(roomId).emit('new_message', messagePayload);
        broadcastDelivered(roomId, messageId);

        try {
          await producer.send({
            topic: 'message_sent',
            messages: [{ value: JSON.stringify(messagePayload) }],
          });
        } catch (err) {
          fastify.log.warn(`Kafka publish failed (non-fatal): ${err.message}`);
        }

        fastify.log.info(`Message saved in room ${roomId} by ${senderId}`);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`User ${socket.data.userId} disconnected: ${socket.id}`);
      });
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
