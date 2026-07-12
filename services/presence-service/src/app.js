const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3005, host: '0.0.0.0' });

    const io = new Server(fastify.server, {
      cors: { origin: '*' }
    });

    io.on('connection', (socket) => {
      const { userId, tenantId } = socket.handshake.query;

      if (userId) {
        // Mark user as online in Redis
        redis.set(`presence:${userId}`, 'online', 'EX', 60); // 1 minute expiry
        io.emit('user_status', { userId, status: 'online' });
        console.log(`User ${userId} is online`);
      }

      // Handle Typing Indicator
      socket.on('typing', (data) => {
        const { roomId, userId, userName } = data;
        socket.to(roomId).emit('user_typing', { roomId, userId, userName });
      });

      socket.on('stop_typing', (data) => {
        const { roomId, userId } = data;
        socket.to(roomId).emit('user_stop_typing', { roomId, userId });
      });

      socket.on('disconnect', () => {
        if (userId) {
          redis.del(`presence:${userId}`);
          io.emit('user_status', { userId, status: 'offline' });
        }
      });
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
