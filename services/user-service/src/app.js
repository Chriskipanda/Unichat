const fastify = require('fastify')({ logger: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { registerJwt, bearerAuth } = require('../../../shared/auth');
registerJwt(fastify, require('@fastify/jwt'));

fastify.get('/api/v1/users/health', async () => ({ status: 'ok', service: 'user-service' }));

// ── GET full profile ────────────────────────────────────────────────────────
fastify.get('/api/v1/users/profile', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId } = request.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, phone: true,
      studentId: true, staffId: true, role: true, avatarUrl: true,
      createdAt: true,
      tenant: { select: { id: true, name: true, slug: true } },
      groups: {
        include: { group: { select: { id: true, name: true, type: true } } },
      },
    },
  });

  if (!user) return reply.code(404).send({ error: 'User not found' });

  const cohortGroup = user.groups.find(m => m.group.type === 'cohort');
  const courseGroups = user.groups.filter(m => m.group.type === 'course');

  let sessionCount = 1;
  try {
    sessionCount = await prisma.session.count({
      where: { userId, expiresAt: { gt: new Date() } },
    });
  } catch (_) {}

  return {
    profile: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      studentId: user.studentId,
      staffId: user.staffId,
      role: user.role,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt.toISOString(),
      tenant: user.tenant,
      cohort: cohortGroup ? cohortGroup.group.name : null,
      courses: courseGroups.map(m => m.group.name),
      sessionCount,
    },
  };
});

// ── PATCH profile ────────────────────────────────────────────────────────────
fastify.patch('/api/v1/users/profile', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId } = request.user;
  const { fullName, phone, avatarUrl } = request.body || {};

  const data = {};
  if (fullName !== undefined && typeof fullName === 'string' && fullName.trim()) {
    data.fullName = fullName.trim();
  }
  if (phone !== undefined) data.phone = phone ? String(phone).trim() || null : null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;

  if (Object.keys(data).length === 0) {
    return reply.code(400).send({ error: 'No valid fields to update' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
    });
    return { user };
  } catch (err) {
    fastify.log.error(`Profile update failed: ${err.message}`);
    return reply.code(500).send({ error: 'Failed to update profile' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3003, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
