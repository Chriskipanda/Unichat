const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Register plugins
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});
fastify.register(require('@fastify/static'), {
  root: UPLOAD_DIR,
  prefix: '/api/v1/messages/uploads/',
});

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
 * Accepts multipart/form-data with fields: senderId, senderName, tenantId + file
 */
fastify.post('/api/v1/messages/:groupId/media', async (request, reply) => {
  const { groupId } = request.params;

  // Parse multipart fields + file
  const parts = request.parts();
  const fields = {};
  let savedPath = null;
  let originalName = 'file';
  let mimeType = 'application/octet-stream';

  for await (const part of parts) {
    if (part.file) {
      // Determine extension from original filename
      const ext = path.extname(part.filename || '').toLowerCase() || '.bin';
      const uuid = crypto.randomUUID();
      const filename = `${uuid}${ext}`;
      savedPath = path.join(UPLOAD_DIR, filename);
      originalName = part.filename || filename;
      mimeType = part.mimetype || mimeType;

      // Stream file to disk
      const writeStream = fs.createWriteStream(savedPath);
      await new Promise((resolve, reject) => {
        part.file.pipe(writeStream);
        part.file.on('end', resolve);
        part.file.on('error', reject);
      });

      fields._filename = filename; // store for URL building
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  if (!savedPath || !fields.senderId) {
    return reply.code(400).send({ error: 'file and senderId are required' });
  }

  // Resolve tenantId
  let tenantId = fields.tenantId;
  if (!tenantId) {
    try {
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { tenantId: true } });
      tenantId = group?.tenantId;
    } catch (_) {}
  }

  const messageId = crypto.randomUUID();
  const now = new Date();
  const senderName = fields.senderName || 'Unknown';

  // Determine message type from mime
  const isVideo = mimeType.startsWith('video/');
  const msgType = isVideo ? 'video' : 'image';

  // Relative URL — nginx routes /api/v1/messages/* to messaging_service
  const fileUrl = `/api/v1/messages/uploads/${fields._filename}`;

  // Persist to DB — store URL as content, type as 'image' or 'video'
  try {
    await prisma.message.create({
      data: { id: messageId, tenantId, groupId, senderId: fields.senderId, content: fileUrl, type: msgType, createdAt: now },
    });
  } catch (err) {
    fastify.log.error(`Failed to persist media message: ${err.message}`);
    return reply.code(500).send({ error: 'Failed to save message' });
  }

  // Fetch sender avatar for the broadcast payload
  let senderAvatar = null;
  try {
    const sender = await prisma.user.findUnique({
      where: { id: fields.senderId },
      select: { avatarUrl: true },
    });
    senderAvatar = sender?.avatarUrl ?? null;
  } catch (_) {}

  const payload = {
    id: messageId,
    roomId: groupId,
    content: fileUrl,
    senderId: fields.senderId,
    senderName,
    senderAvatar,
    tenantId,
    timestamp: now.toISOString(),
    type: msgType,
    originalName,
  };

  // Broadcast to all room members via socket (recipient sees it instantly)
  if (io) io.to(groupId).emit('new_message', payload);
  broadcastDelivered(groupId, messageId);

  fastify.log.info(`[MEDIA] ${msgType} saved in room ${groupId} by ${senderName} — ${fields._filename}`);
  return reply.code(201).send({ message: payload });
});

/**
 * Send a Message (HTTP — reliable alternative to socket emit)
 */
fastify.post('/api/v1/messages/:groupId', async (request, reply) => {
  const { groupId } = request.params;
  const { content, senderId, senderName = 'Unknown', tenantId: bodyTenantId, replyToId } = request.body || {};

  if (!content || !senderId) {
    return reply.code(400).send({ error: 'content and senderId are required' });
  }

  // Resolve tenantId from group when client omits it
  let tenantId = bodyTenantId;
  if (!tenantId) {
    try {
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { tenantId: true } });
      tenantId = group?.tenantId;
    } catch (_) {}
  }

  const messageId = require('crypto').randomUUID();
  const now = new Date();

  const resolvedReplyToId = await resolveReplyToId(replyToId, groupId);

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
    id: messageId, roomId: groupId, content, senderId, senderName,
    tenantId, replyToId: resolvedReplyToId, timestamp: now.toISOString(),
    type: 'text',
    replyTo: serializeReplyTo(saved.replyTo),
  };

  // Broadcast to all sockets in the room
  if (io) io.to(groupId).emit('new_message', payload);
  broadcastDelivered(groupId, messageId);

  fastify.log.info(`Message saved (HTTP) in room ${groupId} by ${senderName}`);
  return reply.code(201).send({ message: payload });
});

/**
 * Get Message History for a Group
 */
fastify.get('/api/v1/messages/:groupId', async (request, reply) => {
  const { groupId } = request.params;
  const { limit = '60', before } = request.query || {};

  const messages = await prisma.message.findMany({
    where: {
      groupId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: parseInt(limit),
    include: {
      sender: { select: { fullName: true, avatarUrl: true } },
      replyTo: { include: { sender: { select: { fullName: true } } } },
    },
  });

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
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3002, host: '0.0.0.0' });

    // Attach Socket.IO (assign to module-level var so HTTP handlers can broadcast)
    io = new Server(fastify.server, {
      cors: { origin: '*' }
    });

    await producer.connect();

    io.on('connection', (socket) => {
      fastify.log.info(`User connected: ${socket.id}`);

      // Join a room (e.g., a specific group/channel)
      socket.on('join_room', (roomId) => {
        socket.join(roomId);
        fastify.log.info(`User ${socket.id} joined room: ${roomId}`);
      });

      // A client emits this the moment its chat screen for roomId is open
      // and showing messages. Relayed to everyone else in the room (not
      // back to the reader) so the sender's ticks flip to blue live —
      // socket.to() excludes the emitting socket, unlike io.to().
      socket.on('room_read', ({ roomId, userId }) => {
        if (!roomId || !userId) return;
        socket.to(roomId).emit('peer_read', { roomId, userId });
      });

      // Handle New Message
      socket.on('send_message', async (data) => {
        const { roomId, content, senderId, senderName = 'Unknown', replyToId } = data;
        let { tenantId } = data;

        const messageId = require('crypto').randomUUID();
        const now = new Date();

        // Resolve tenantId from the group if the client didn't send it (or sent null)
        if (!tenantId) {
          try {
            const group = await prisma.group.findUnique({ where: { id: roomId }, select: { tenantId: true } });
            tenantId = group?.tenantId;
          } catch (_) {}
        }

        const resolvedReplyToId = await resolveReplyToId(replyToId, roomId);

        const messagePayload = {
          id: messageId,
          roomId,
          content,
          senderId,
          senderName,
          tenantId,
          replyToId: resolvedReplyToId,
          timestamp: now.toISOString(),
          createdAt: now,
        };

        // 1. Broadcast to the room immediately (real-time)
        io.to(roomId).emit('new_message', messagePayload);
        broadcastDelivered(roomId, messageId);

        // 2. Persist directly to DB so history is available instantly
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
        }

        // 3. Publish to Kafka for downstream services (notifications, analytics)
        try {
          await producer.send({
            topic: 'message_sent',
            messages: [{ value: JSON.stringify(messagePayload) }],
          });
        } catch (err) {
          fastify.log.warn(`Kafka publish failed (non-fatal): ${err.message}`);
        }

        fastify.log.info(`Message saved in room ${roomId} by ${senderName}`);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`User disconnected: ${socket.id}`);
      });
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
