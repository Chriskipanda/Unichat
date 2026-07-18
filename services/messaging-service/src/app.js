const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { registerJwt, bearerAuthWithTenant: bearerAuth, verifyToken } = require('../../../shared/auth');

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Register plugins
registerJwt(fastify, require('@fastify/jwt'));
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

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Every route below (except /health) requires a valid JWT. Identity for a
// send/read always comes from the verified token, never from the request
// body or query string — the client cannot claim to be another user.

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

// Monotonic per-room counter, backed by Redis so it survives across
// instances (once more than one replica is running behind the adapter
// below). Lets a client detect a gap in what it received while
// disconnected — "I have seq 41, then 45 arrived" — instead of silently
// having no way to know anything was missed.
async function nextSeq(roomId) {
  return redis.incr(`room_seq:${roomId}`);
}

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'messaging-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});
const producer = kafka.producer();

// Module-level io reference — assigned inside start() after server listens
let io = null;

// One MessageReceipt row per other room member, created at send time. See
// the schema comment on MessageReceipt for why eager-at-send rather than
// lazy-on-first-touch.
async function createReceipts(messageId, groupId, senderId) {
  const others = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: senderId } },
    select: { userId: true },
  });
  if (!others.length) return;
  await prisma.messageReceipt.createMany({
    data: others.map(m => ({ messageId, userId: m.userId })),
    skipDuplicates: true,
  });
}

// "Delivered" (double grey tick) means at least one other socket is already
// in the room when the message broadcasts — i.e. a recipient has the chat
// open on their device. Now backed by a persisted MessageReceipt row per
// recipient instead of only a live Socket.IO signal, so it survives reload.
async function broadcastDelivered(roomId, messageId) {
  if (!io) return;
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room || room.size <= 1) return;
  const userIds = [...room]
    .map(sid => io.sockets.sockets.get(sid)?.data?.userId)
    .filter(Boolean);
  if (userIds.length) {
    await prisma.messageReceipt.updateMany({
      where: { messageId, userId: { in: userIds }, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  }
  io.to(roomId).emit('message_delivered', { roomId, messageId });
}

// Self-heal on join: broadcastDelivered() above only checks who's in the
// room at the exact instant a message is sent — if this user's socket
// wasn't joined yet (reconnecting, app still starting up), every message
// sent in the meantime is stuck undelivered with nothing to re-check it.
// Joining now is the second chance: mark everything not yet delivered to
// this specific user as delivered.
async function markDeliveredOnJoin(userId, groupId) {
  const messages = await prisma.message.findMany({
    where: { groupId, senderId: { not: userId } },
    select: { id: true },
  });
  if (!messages.length) return;
  await prisma.messageReceipt.updateMany({
    where: { userId, messageId: { in: messages.map(m => m.id) }, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });
}

// Mark every message in the room not sent by this user as read (and
// delivered, if that was somehow still unset) — the persisted counterpart
// to the room_read/peer_read live socket signal.
async function markRead(userId, groupId) {
  const messages = await prisma.message.findMany({
    where: { groupId, senderId: { not: userId } },
    select: { id: true },
  });
  if (!messages.length) return;
  const ids = messages.map(m => m.id);
  const now = new Date();
  await prisma.messageReceipt.updateMany({
    where: { userId, messageId: { in: ids }, deliveredAt: null },
    data: { deliveredAt: now, readAt: now },
  });
  await prisma.messageReceipt.updateMany({
    where: { userId, messageId: { in: ids }, readAt: null },
    data: { readAt: now },
  });
}

// For the sender's own messages on history reload: real status from
// persisted receipts, not a room-level timestamp approximation. "read" if
// any recipient has read it, "delivered" if any recipient has it but none
// have read yet — exact for a DM, the same documented over-generous
// approximation as before for a group (flips blue on the first reader).
function statusFromReceipts(receipts) {
  if (receipts.some(r => r.readAt)) return 'read';
  if (receipts.some(r => r.deliveredAt)) return 'delivered';
  return 'sent';
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
 * Accepts multipart/form-data with a file plus optional text fields
 * (clientMessageId, replyToId). Sender identity comes from the JWT.
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
  const fields = {};

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
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  if (!savedPath) {
    return reply.code(400).send({ error: 'file is required' });
  }

  // Idempotent retry — see the text-send route for the full rationale.
  if (fields.clientMessageId) {
    const existing = await prisma.message.findUnique({ where: { clientMessageId: fields.clientMessageId } });
    if (existing) {
      return reply.code(200).send({ message: await serializeExisting(existing) });
    }
  }

  const messageId = crypto.randomUUID();
  const now = new Date();

  const msgType = mimeType.startsWith('video/') ? 'video'
    : mimeType.startsWith('audio/') ? 'audio'
    : mimeType.startsWith('image/') ? 'image'
    : 'document';
  const fileMetadata = msgType === 'document' || msgType === 'audio'
    ? { originalName, mimeType }
    : {};

  // Relative URL — nginx routes /api/v1/messages/* to messaging_service
  const fileUrl = `/api/v1/messages/uploads/${filename}`;

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true, avatarUrl: true },
  });

  try {
    await prisma.message.create({
      data: {
        id: messageId, tenantId, groupId, senderId, content: fileUrl, type: msgType, metadata: fileMetadata,
        clientMessageId: fields.clientMessageId || undefined, createdAt: now,
      },
    });
  } catch (err) {
    if (err.code === 'P2002' && fields.clientMessageId) {
      const existing = await prisma.message.findUnique({ where: { clientMessageId: fields.clientMessageId } });
      if (existing) return reply.code(200).send({ message: await serializeExisting(existing) });
    }
    fastify.log.error(`Failed to persist media message: ${err.message}`);
    return reply.code(500).send({ error: 'Failed to save message' });
  }

  await createReceipts(messageId, groupId, senderId);
  const seq = await nextSeq(groupId);

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
    metadata: fileMetadata,
    originalName,
    seq,
  };

  if (io) io.to(groupId).emit('new_message', payload);
  await broadcastDelivered(groupId, messageId);

  fastify.log.info(`[MEDIA] ${msgType} saved in room ${groupId} by ${senderId}`);
  return reply.code(201).send({ message: payload });
});

// Shared shape for "this clientMessageId already exists, hand back what was
// actually persisted" — used by every idempotent-retry path.
async function serializeExisting(existing) {
  const sender = await prisma.user.findUnique({ where: { id: existing.senderId }, select: { fullName: true, avatarUrl: true } });
  return {
    id: existing.id, roomId: existing.groupId, content: existing.content, senderId: existing.senderId,
    senderName: sender?.fullName ?? 'Unknown', senderAvatar: sender?.avatarUrl ?? null,
    tenantId: existing.tenantId, replyToId: existing.replyToId, timestamp: existing.createdAt.toISOString(),
    type: existing.type ?? 'text', metadata: existing.metadata ?? {},
  };
}

// Types sendable through the plain (non-file) send route below — each is
// just structured data in `metadata`, no upload involved. Media types
// ('image'/'video'/'document'/'audio') only ever come from the /media route.
const METADATA_MESSAGE_TYPES = ['text', 'location', 'contact', 'poll', 'event'];

function validateMetadataForType(type, metadata) {
  if (type === 'poll') {
    const question = metadata?.question?.trim();
    const options = Array.isArray(metadata?.options) ? metadata.options.filter((o) => typeof o === 'string' && o.trim()) : [];
    if (!question || options.length < 2) return null;
    return { question, options: options.map((text) => ({ text: text.trim(), votes: [] })) };
  }
  if (type === 'location') {
    const { lat, lng } = metadata || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { lat, lng, label: typeof metadata.label === 'string' ? metadata.label : null };
  }
  if (type === 'contact') {
    const name = metadata?.name?.trim();
    if (!name) return null;
    return { name, phone: typeof metadata.phone === 'string' ? metadata.phone : null };
  }
  if (type === 'event') {
    const title = metadata?.title?.trim();
    const startsAt = metadata?.startsAt;
    if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) return null;
    return { title, startsAt, location: typeof metadata.location === 'string' ? metadata.location : null };
  }
  return {};
}

/**
 * Send a Message (HTTP — reliable alternative to socket emit)
 */
fastify.post('/api/v1/messages/:groupId', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId } = request.params;
  const { userId: senderId, tenantId } = request.user;
  const { content, replyToId, clientMessageId, type = 'text', metadata } = request.body || {};

  if (!content) {
    return reply.code(400).send({ error: 'content is required' });
  }
  if (!METADATA_MESSAGE_TYPES.includes(type)) {
    return reply.code(400).send({ error: `Unsupported message type: ${type}` });
  }
  const resolvedMetadata = validateMetadataForType(type, metadata);
  if (resolvedMetadata === null) {
    return reply.code(400).send({ error: `Invalid or missing metadata for a ${type} message` });
  }

  if (!(await isRoomMember(groupId, senderId))) {
    return reply.code(403).send({ error: 'Not a member of this room' });
  }

  // Idempotent retry: a client that never got the response to an earlier
  // attempt (timeout, dropped connection) can't tell "never reached the
  // server" from "arrived, response lost" and will retry with the SAME
  // clientMessageId. Recognizing that here — instead of blindly inserting —
  // is what makes a retried send safe instead of a duplicate message.
  if (clientMessageId) {
    const existing = await prisma.message.findUnique({ where: { clientMessageId } });
    if (existing) {
      return reply.code(200).send({ message: await serializeExisting(existing) });
    }
  }

  const messageId = crypto.randomUUID();
  const now = new Date();

  const resolvedReplyToId = await resolveReplyToId(replyToId, groupId);
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } });

  let saved;
  try {
    saved = await prisma.message.create({
      data: {
        id: messageId, tenantId, groupId, senderId, content, replyToId: resolvedReplyToId,
        type, metadata: resolvedMetadata,
        clientMessageId: clientMessageId || undefined, createdAt: now,
      },
      include: { replyTo: { include: { sender: { select: { fullName: true } } } } },
    });
  } catch (err) {
    // Unique-constraint race: two near-simultaneous retries of the same send
    // both missed the findUnique above and both tried to insert. The loser
    // here didn't fail to send — it lost a harmless tie. Return the winner.
    if (err.code === 'P2002' && clientMessageId) {
      const existing = await prisma.message.findUnique({ where: { clientMessageId } });
      if (existing) return reply.code(200).send({ message: await serializeExisting(existing) });
    }
    fastify.log.error(`Failed to persist message (HTTP): ${err.message}`);
    return reply.code(500).send({ error: 'Failed to save message' });
  }

  await createReceipts(messageId, groupId, senderId);
  const seq = await nextSeq(groupId);

  const payload = {
    id: messageId, roomId: groupId, content, senderId, senderName: sender?.fullName ?? 'Unknown',
    tenantId, replyToId: resolvedReplyToId, timestamp: now.toISOString(),
    type, metadata: resolvedMetadata, seq,
    replyTo: serializeReplyTo(saved.replyTo),
  };

  if (io) io.to(groupId).emit('new_message', payload);
  await broadcastDelivered(groupId, messageId);

  fastify.log.info(`Message saved (HTTP) in room ${groupId} by ${senderId}`);
  return reply.code(201).send({ message: payload });
});

/**
 * Vote (or change/retract a vote) on a poll message. Single-choice: picking
 * a new option removes any prior vote by this user; voting the option
 * already held retracts it. Not the text-edit route on purpose — voting is
 * available to every room member, not just the poll's sender.
 */
fastify.post('/api/v1/messages/:groupId/:messageId/vote', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId, messageId } = request.params;
  const { userId } = request.user;
  const { optionIndex } = request.body || {};

  if (!(await isRoomMember(groupId, userId))) {
    return reply.code(403).send({ error: 'Not a member of this room' });
  }
  if (!Number.isInteger(optionIndex)) {
    return reply.code(400).send({ error: 'optionIndex is required' });
  }

  const message = await prisma.message.findFirst({ where: { id: messageId, groupId } });
  if (!message) return reply.code(404).send({ error: 'Message not found' });
  if (message.type !== 'poll') return reply.code(400).send({ error: 'Not a poll message' });
  if (message.deletedAt) return reply.code(400).send({ error: 'Cannot vote on a deleted message' });

  const options = Array.isArray(message.metadata?.options) ? message.metadata.options : [];
  if (optionIndex < 0 || optionIndex >= options.length) {
    return reply.code(400).send({ error: 'Invalid optionIndex' });
  }

  const alreadyOnThis = options[optionIndex].votes.includes(userId);
  const nextOptions = options.map((opt, i) => ({
    text: opt.text,
    votes: i === optionIndex
      ? (alreadyOnThis ? opt.votes.filter((v) => v !== userId) : [...opt.votes.filter((v) => v !== userId), userId])
      : opt.votes.filter((v) => v !== userId),
  }));
  const nextMetadata = { ...message.metadata, options: nextOptions };

  await prisma.message.update({ where: { id: messageId }, data: { metadata: nextMetadata } });

  if (io) io.to(groupId).emit('message_voted', { roomId: groupId, messageId, metadata: nextMetadata });

  return { messageId, metadata: nextMetadata };
});

/**
 * Edit a message — sender only, text messages only.
 */
fastify.patch('/api/v1/messages/:groupId/:messageId', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId, messageId } = request.params;
  const { userId } = request.user;
  const { content } = request.body || {};

  if (!content) return reply.code(400).send({ error: 'content is required' });

  const message = await prisma.message.findFirst({ where: { id: messageId, groupId } });
  if (!message) return reply.code(404).send({ error: 'Message not found' });
  if (message.senderId !== userId) return reply.code(403).send({ error: 'Only the sender can edit this message' });
  if (message.deletedAt) return reply.code(400).send({ error: 'Cannot edit a deleted message' });
  if (message.type !== 'text') return reply.code(400).send({ error: 'Only text messages can be edited' });

  const now = new Date();
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, isEdited: true, editedAt: now },
  });

  if (io) io.to(groupId).emit('message_edited', { roomId: groupId, messageId, content, editedAt: now.toISOString() });
  return { message: updated };
});

/**
 * Delete a message for everyone — sender only. Soft delete: the row stays
 * (so replies pointing at it and room ordering are unaffected) but content
 * is cleared and every client renders it as a tombstone.
 */
fastify.delete('/api/v1/messages/:groupId/:messageId', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId, messageId } = request.params;
  const { userId } = request.user;

  const message = await prisma.message.findFirst({ where: { id: messageId, groupId } });
  if (!message) return reply.code(404).send({ error: 'Message not found' });
  if (message.senderId !== userId) return reply.code(403).send({ error: 'Only the sender can delete this message for everyone' });
  if (message.deletedAt) return { ok: true };

  await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date(), content: '' } });

  if (io) io.to(groupId).emit('message_deleted', { roomId: groupId, messageId });
  return { ok: true };
});

/**
 * Set or replace this user's reaction on a message. One active reaction per
 * user per message — a new emoji replaces the old one.
 */
fastify.put('/api/v1/messages/:groupId/:messageId/reaction', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId, messageId } = request.params;
  const { userId } = request.user;
  const { emoji } = request.body || {};

  if (!emoji) return reply.code(400).send({ error: 'emoji is required' });
  if (!(await isRoomMember(groupId, userId))) return reply.code(403).send({ error: 'Not a member of this room' });

  const message = await prisma.message.findFirst({ where: { id: messageId, groupId } });
  if (!message) return reply.code(404).send({ error: 'Message not found' });

  await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });

  if (io) io.to(groupId).emit('reaction_added', { roomId: groupId, messageId, userId, emoji });
  return { ok: true };
});

fastify.delete('/api/v1/messages/:groupId/:messageId/reaction', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId, messageId } = request.params;
  const { userId } = request.user;

  await prisma.messageReaction.deleteMany({ where: { messageId, userId } });

  if (io) io.to(groupId).emit('reaction_removed', { roomId: groupId, messageId, userId });
  return { ok: true };
});

/**
 * Search this room's text messages by content. Simple ILIKE — fine at this
 * app's scale; would need a dedicated search index long before this became
 * a bottleneck.
 */
fastify.get('/api/v1/messages/:groupId/search', { preHandler: bearerAuth }, async (request, reply) => {
  const { groupId } = request.params;
  const { userId } = request.user;
  const { q } = request.query || {};

  if (!q || q.trim().length < 2) return reply.code(400).send({ error: 'q must be at least 2 characters' });
  if (!(await isRoomMember(groupId, userId))) return reply.code(403).send({ error: 'Not a member of this room' });

  const results = await prisma.message.findMany({
    where: { groupId, type: 'text', deletedAt: null, content: { contains: q.trim(), mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { sender: { select: { fullName: true } } },
  });

  return {
    results: results.map(m => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderName: m.sender?.fullName ?? 'Unknown',
      timestamp: m.createdAt.toISOString(),
    })),
  };
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
      receipts: { select: { deliveredAt: true, readAt: true } },
      reactions: { select: { userId: true, emoji: true } },
    },
  });

  return {
    messages: messages.map(m => ({
      id: m.id,
      content: m.deletedAt ? '' : m.content,
      deleted: !!m.deletedAt,
      senderId: m.senderId,
      senderName: m.sender?.fullName ?? 'Unknown',
      senderAvatar: m.sender?.avatarUrl ?? null,
      timestamp: m.createdAt.toISOString(),
      type: m.type ?? 'text',
      isEdited: m.isEdited,
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      replyToId: m.replyToId ?? null,
      replyTo: serializeReplyTo(m.replyTo),
      // Only meaningful for the sender's own messages — real per-message
      // status from persisted receipts, not a room-level approximation.
      status: m.senderId === userId ? statusFromReceipts(m.receipts) : undefined,
      reactions: m.reactions,
    })),
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

    // Redis adapter: without this, io.to(roomId).emit(...) only reaches
    // sockets connected to THIS process. Running more than one replica
    // (the whole point of adding this) would otherwise silently drop
    // broadcasts for anyone whose socket landed on a different instance —
    // this fans every broadcast out over Redis pub/sub to all instances.
    // A single replica today behaves identically with or without it; this
    // removes the barrier to ever safely running more than one.
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));

    // Every socket must present a valid JWT before it's allowed to connect at
    // all — the client sends it as `auth: { token }` (works identically over
    // websocket and polling, unlike an HTTP header which browsers can drop on
    // the websocket upgrade). Identity derived here is what every handler
    // below trusts; nothing from the client payload overrides it.
    io.use((socket, next) => {
      try {
        const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        const payload = verifyToken(fastify, raw);
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

        // Persisted self-heal: anything sent to this room while this user
        // wasn't connected gets marked delivered now that they're back.
        await markDeliveredOnJoin(socket.data.userId, roomId);

        // Live self-heal: message_delivered only fires once, at the instant
        // a message broadcasts — if the recipient's socket wasn't in the
        // room yet at that exact moment, a message could stay stuck on a
        // single tick with nothing to re-check it. Someone (re)joining now
        // is a second chance: tell whoever's already there.
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size > 1) {
          socket.to(roomId).emit('room_active', { roomId });
        }
      });

      // A client emits this the moment its chat screen for roomId is open
      // and showing messages. Persists real read receipts and relays to
      // everyone else in the room (not back to the reader) so the sender's
      // ticks flip to blue live — socket.to() excludes the emitting socket,
      // unlike io.to(). userId is always the verified identity, never
      // whatever the client sent.
      socket.on('room_read', async ({ roomId } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        await markRead(socket.data.userId, roomId);
        socket.to(roomId).emit('peer_read', { roomId, userId: socket.data.userId });
      });

      // Send over the socket, with a real acknowledgement — the client
      // learns whether the send actually succeeded from this callback
      // instead of only ever firing-and-forgetting. Same identity/
      // membership/idempotency rules as the HTTP route.
      socket.on('send_message', async ({ roomId, content, replyToId, clientMessageId } = {}, callback) => {
        const ack = typeof callback === 'function' ? callback : () => {};
        if (!roomId || !content) return ack({ error: 'roomId and content are required' });
        if (!(await isRoomMember(roomId, socket.data.userId))) return ack({ error: 'Not a member of this room' });

        const senderId = socket.data.userId;
        const tenantId = socket.data.tenantId;

        if (clientMessageId) {
          const existing = await prisma.message.findUnique({ where: { clientMessageId } });
          if (existing) return ack({ message: await serializeExisting(existing) });
        }

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
              clientMessageId: clientMessageId || undefined,
              createdAt: now,
            },
          });
        } catch (err) {
          if (err.code === 'P2002' && clientMessageId) {
            const existing = await prisma.message.findUnique({ where: { clientMessageId } });
            if (existing) return ack({ message: await serializeExisting(existing) });
          }
          fastify.log.error(`Failed to persist message: ${err.message}`);
          return ack({ error: 'Failed to save message' });
        }

        await createReceipts(messageId, roomId, senderId);
        messagePayload.seq = await nextSeq(roomId);

        io.to(roomId).emit('new_message', messagePayload);
        await broadcastDelivered(roomId, messageId);

        try {
          await producer.send({
            topic: 'message_sent',
            messages: [{ value: JSON.stringify(messagePayload) }],
          });
        } catch (err) {
          fastify.log.warn(`Kafka publish failed (non-fatal): ${err.message}`);
        }

        fastify.log.info(`Message saved in room ${roomId} by ${senderId}`);
        ack({ message: messagePayload });
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
