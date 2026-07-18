const fastify = require('fastify')({ logger: true });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const { registerJwt, bearerAuth } = require('../../../shared/auth');
registerJwt(fastify, require('@fastify/jwt'));
fastify.register(require('@fastify/rate-limit'), {
  max: 60,
  timeWindow: '1 minute',
});
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap, matches messaging-service's own media path
});

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// The URL handed back to clients must be reachable from wherever the
// browser/app actually is — "localhost" only resolves on the server itself.
// Set to the gateway's public address in production (see docker-compose.vps.yml).
const PUBLIC_MEDIA_URL = process.env.PUBLIC_MEDIA_URL || 'http://localhost';

// Static files served at /api/v1/media/uploads/* — matches the nginx proxy path
fastify.register(require('@fastify/static'), {
  root: uploadsDir,
  prefix: '/api/v1/media/uploads/',
});

// Anonymous, type-unrestricted upload used to let anyone anonymously host
// arbitrary files on this server. Now: authenticated, and restricted to the
// media types the app actually needs (chat attachments, avatars).
const GENERAL_ALLOWED = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];

fastify.post('/api/v1/media/upload', { preHandler: bearerAuth }, async (req, reply) => {
  let data;
  try {
    data = await req.file();
  } catch (err) {
    return reply.code(400).send({ error: 'Invalid multipart request' });
  }
  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

  if (!GENERAL_ALLOWED.includes(data.mimetype)) {
    data.file.resume();
    return reply.code(400).send({ error: 'Unsupported file type' });
  }

  const ext = path.extname(data.filename || '').toLowerCase() || '.bin';
  const filename = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  await pipeline(data.file, fs.createWriteStream(filePath));
  return { url: `${PUBLIC_MEDIA_URL}/api/v1/media/uploads/${filename}`, type: data.mimetype, name: data.filename };
});

// Logo upload — images only, 2MB enforced after read
fastify.post('/api/v1/media/upload/logo', { preHandler: bearerAuth }, async (req, reply) => {
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_BYTES = 2 * 1024 * 1024;

  let data;
  try {
    data = await req.file();
  } catch (err) {
    return reply.code(400).send({ error: 'Invalid multipart request' });
  }

  if (!data) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  if (!ALLOWED.includes(data.mimetype)) {
    // drain the stream before rejecting so the connection stays clean
    data.file.resume();
    return reply.code(400).send({ error: 'Only PNG, JPEG or WebP images are accepted' });
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of data.file) {
    total += chunk.length;
    if (total > MAX_BYTES) {
      return reply.code(400).send({ error: 'Logo must be under 2 MB' });
    }
    chunks.push(chunk);
  }

  const ext = data.mimetype === 'image/png' ? 'png'
            : data.mimetype === 'image/webp' ? 'webp'
            : 'jpg';
  const filename = `logo-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.concat(chunks));

  return { url: `${PUBLIC_MEDIA_URL}/api/v1/media/uploads/${filename}` };
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3006, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
