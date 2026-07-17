const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const { registerJwt, verifyToken } = require('../../../shared/auth');
registerJwt(fastify, require('@fastify/jwt'));

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PRESENCE_TTL_SECONDS = 60;

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3005, host: '0.0.0.0' });

    const io = new Server(fastify.server, {
      cors: { origin: '*' }
    });

    // Same reasoning as messaging-service: without this, `io.emit(...)`
    // (used for user_status below) only reaches sockets on this process.
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));

    // A user's online status used to be whatever the client claimed via a
    // raw query string — trivially spoofable. Identity now comes from the
    // same verified JWT every other service requires.
    io.use((socket, next) => {
      try {
        const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        const payload = verifyToken(fastify, raw);
        socket.data.userId = payload.userId;
        socket.data.tenantId = payload.tenantId;
        next();
      } catch (err) {
        next(new Error('unauthorized'));
      }
    });

    io.on('connection', (socket) => {
      const { userId } = socket.data;

      redis.set(`presence:${userId}`, 'online', 'EX', PRESENCE_TTL_SECONDS);
      io.emit('user_status', { userId, status: 'online' });
      fastify.log.info(`User ${userId} is online`);

      // The Redis key expires after PRESENCE_TTL_SECONDS regardless of
      // whether the socket is still connected — without a periodic renewal,
      // a long-lived idle connection would silently read back as offline.
      const renew = setInterval(() => {
        redis.set(`presence:${userId}`, 'online', 'EX', PRESENCE_TTL_SECONDS);
      }, (PRESENCE_TTL_SECONDS / 2) * 1000);

      // Typing events are relayed with socket.to(roomId), which only reaches
      // sockets that have joined that room — so clients must join first.
      // NOTE: room membership is not verified against the database here
      // (presence-service has no DB access today) — a connected, authenticated
      // user can join any roomId string and receive typing signals for it.
      // Lower severity than the equivalent gap in messaging-service (no
      // message content is exposed), but tracked as follow-up work: either
      // give this service a Prisma client to check GroupMember, or have it
      // validate room membership via an internal call to auth-service.
      socket.on('join_room', (roomId) => {
        if (roomId) socket.join(roomId);
      });

      socket.on('leave_room', (roomId) => {
        if (roomId) socket.leave(roomId);
      });

      // Typing indicator — identity always the verified socket.data.userId,
      // never whatever the client's payload claims.
      socket.on('typing', ({ roomId, userName } = {}) => {
        if (!roomId) return;
        socket.to(roomId).emit('user_typing', { roomId, userId, userName });
      });

      socket.on('stop_typing', ({ roomId } = {}) => {
        if (!roomId) return;
        socket.to(roomId).emit('user_stop_typing', { roomId, userId });
      });

      socket.on('disconnect', () => {
        clearInterval(renew);
        redis.del(`presence:${userId}`);
        io.emit('user_status', { userId, status: 'offline' });
      });
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
