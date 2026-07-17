const fastify = require('fastify')({ logger: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Redis = require('ioredis');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with an insecure default.');
  process.exit(1);
}

fastify.register(require('@fastify/jwt'), { secret: process.env.JWT_SECRET });

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Any tenant's branding used to be rewritable by anyone — this requires a
// valid token AND either superadmin (any tenant) or that tenant's own admin.
const brandingAuth = async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
  const { role, tenantId } = request.user;
  const { id } = request.params;
  if (role === 'superadmin') return;
  if (role === 'admin' && tenantId === id) return;
  return reply.code(403).send({ error: 'Not authorized to modify this tenant' });
};

// Health check
fastify.get('/api/v1/tenants/health', async (request, reply) => {
  return { status: 'ok', service: 'tenant-service' };
});

/**
 * Get Tenant Branding & Settings
 * GET /api/v1/tenants/:slug
 */
fastify.get('/api/v1/tenants/:slug', async (request, reply) => {
  const { slug } = request.params;

  // Try to get from cache first
  const cacheKey = `tenant:${slug}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      branding: true,
      settings: true
    }
  });

  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });

  // Cache for 1 hour
  await redis.set(cacheKey, JSON.stringify(tenant), 'EX', 3600);

  return tenant;
});

/**
 * Update Tenant Branding (Admin only - simplified for now)
 */
fastify.patch('/api/v1/tenants/:id/branding', { preHandler: brandingAuth }, async (request, reply) => {
  const { id } = request.params;
  const { branding } = request.body;

  const updated = await prisma.tenant.update({
    where: { id },
    data: { branding }
  });

  // Invalidate cache
  await redis.del(`tenant:${updated.slug}`);

  return updated;
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3004, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
