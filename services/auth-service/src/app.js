const fastify = require('fastify')({ logger: true });
const otpService = require('./services/otp.service');
const smsService = require('./services/sms.service');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
});
const producer = kafka.producer();

fastify.register(require('@fastify/cors'), { origin: true, credentials: true });
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'super_secret_unichat_key',
});

// ─────────────────────────────────────────────────────────────────
// Route guards
// ─────────────────────────────────────────────────────────────────
const superAdminOnly = async (request, reply) => {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'superadmin')
      return reply.code(403).send({ error: 'Superadmin access required' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

const institutionAdminOnly = async (request, reply) => {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin')
      return reply.code(403).send({ error: 'Institution admin access required' });
    if (!request.user.tenantId)
      return reply.code(403).send({ error: 'No institution scope in token' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

const TEACHER_ROLES = ['teacher', 'lecturer', 'staff'];

const teacherOnly = async (request, reply) => {
  try {
    await request.jwtVerify();
    if (!TEACHER_ROLES.includes(request.user.role))
      return reply.code(403).send({ error: 'Teacher access required' });
    if (!request.user.tenantId)
      return reply.code(403).send({ error: 'No institution scope in token' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

// ─────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────
fastify.get('/api/v1/auth/health', async () => ({ status: 'ok', service: 'auth-service' }));

// ─────────────────────────────────────────────────────────────────
// Public — list active institutions (used by mobile TenantScreen + admin login)
// ─────────────────────────────────────────────────────────────────
fastify.get('/api/v1/auth/institutions', async () => {
  const institutions = await prisma.tenant.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, slug: true, logoUrl: true },
    orderBy: { name: 'asc' },
  });
  return { institutions };
});

// ─────────────────────────────────────────────────────────────────
// SuperAdmin — password login
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/auth/admin/login', async (request, reply) => {
  const { email, password } = request.body || {};
  if (!email || !password)
    return reply.code(400).send({ error: 'Email and password are required' });

  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), role: 'superadmin', isActive: true },
    });
    if (!user || !user.passwordHash)
      return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = fastify.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '24h' });
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    return { token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────
// Institution Admin — OTP login (role-gated to 'admin')
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/auth/institution/request-otp', async (request, reply) => {
  const { identifier, tenantSlug } = request.body || {};
  if (!identifier || !tenantSlug)
    return reply.code(400).send({ error: 'Identifier and institution slug required' });

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });
  if (tenant.status !== 'active') return reply.code(403).send({ error: 'Institution is not active' });

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: 'admin',
      isActive: true,
      OR: [{ email: identifier }, { studentId: identifier }, { staffId: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'Admin account not found for this institution' });

  const otp = otpService.generateOtp();
  await redis.set(`otp:admin:${tenant.id}:${user.id}`, otp, 'EX', 300);

  const sms = await smsService.sendOtp(user.phone, otp);
  if (sms.sent) {
    fastify.log.info(`[ADMIN OTP] ${user.fullName} @ ${tenant.slug}: sent via SMS to ${smsService.maskPhone(user.phone)}`);
  } else {
    fastify.log.info(`[ADMIN OTP] ${user.fullName} @ ${tenant.slug}: ${otp}  [sms: ${sms.reason || sms.error}]`);
  }

  return { message: 'OTP sent', user: { fullName: user.fullName, email: user.email } };
});

fastify.post('/api/v1/auth/institution/verify-otp', async (request, reply) => {
  const { identifier, tenantSlug, otp } = request.body || {};

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: 'admin',
      isActive: true,
      OR: [{ email: identifier }, { studentId: identifier }, { staffId: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'Admin account not found' });

  const redisKey = `otp:admin:${tenant.id}:${user.id}`;
  const storedOtp = await redis.get(redisKey);
  if (!storedOtp) return reply.code(400).send({ error: 'OTP expired or not requested' });
  if (storedOtp !== otp) return reply.code(400).send({ error: 'Invalid OTP' });

  await redis.del(redisKey);

  const token = fastify.jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    { expiresIn: '12h' }
  );
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, branding: tenant.branding },
    },
  };
});

// ─────────────────────────────────────────────────────────────────
// Teacher — OTP login (role-gated to teacher/lecturer/staff)
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/auth/teacher/request-otp', async (request, reply) => {
  const { identifier, tenantSlug } = request.body || {};
  if (!identifier || !tenantSlug)
    return reply.code(400).send({ error: 'Identifier and institution slug required' });

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });
  if (tenant.status !== 'active') return reply.code(403).send({ error: 'Institution is not active' });

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: { in: TEACHER_ROLES },
      isActive: true,
      OR: [{ email: identifier }, { staffId: identifier }, { phone: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'Teacher account not found for this institution' });

  const otp = otpService.generateOtp();
  await redis.set(`otp:teacher:${tenant.id}:${user.id}`, otp, 'EX', 300);

  const sms = await smsService.sendOtp(user.phone, otp);
  if (sms.sent) {
    fastify.log.info(`[TEACHER OTP] ${user.fullName} @ ${tenant.slug}: sent via SMS to ${smsService.maskPhone(user.phone)}`);
  } else {
    fastify.log.info(`[TEACHER OTP] ${user.fullName} @ ${tenant.slug}: ${otp}  [sms: ${sms.reason || sms.error}]`);
  }

  return { message: 'OTP sent', user: { fullName: user.fullName, email: user.email } };
});

fastify.post('/api/v1/auth/teacher/verify-otp', async (request, reply) => {
  const { identifier, tenantSlug, otp } = request.body || {};

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: { in: TEACHER_ROLES },
      isActive: true,
      OR: [{ email: identifier }, { staffId: identifier }, { phone: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'Teacher account not found' });

  const redisKey = `otp:teacher:${tenant.id}:${user.id}`;
  const storedOtp = await redis.get(redisKey);
  if (!storedOtp) return reply.code(400).send({ error: 'OTP expired or not requested' });
  if (storedOtp !== otp) return reply.code(400).send({ error: 'Invalid OTP' });

  await redis.del(redisKey);

  const token = fastify.jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    { expiresIn: '12h' }
  );
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, branding: tenant.branding },
    },
  };
});

// ─────────────────────────────────────────────────────────────────
// SuperAdmin — tenant & platform management
// ─────────────────────────────────────────────────────────────────
fastify.get('/api/v1/admin/tenants', { preHandler: superAdminOnly }, async (request, reply) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });
    return { tenants };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/api/v1/admin/tenants', { preHandler: superAdminOnly }, async (request, reply) => {
  const { name, slug, domain, plan, maxUsers } = request.body || {};
  if (!name || !slug) return reply.code(400).send({ error: 'Name and slug are required' });

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        domain: domain || null,
        plan: plan || 'starter',
        status: 'active',
        maxUsers: maxUsers || 500,
        branding: {},
        settings: { allowSelfRegistration: false, requireOtp: true },
      },
    });
    return reply.code(201).send({ tenant });
  } catch (err) {
    if (err.code === 'P2002') return reply.code(409).send({ error: 'Slug or domain already exists' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.patch('/api/v1/admin/tenants/:id', { preHandler: superAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { plan, status, maxUsers, name, domain } = request.body || {};
  const data = {};
  if (plan !== undefined) data.plan = plan;
  if (status !== undefined) data.status = status;
  if (maxUsers !== undefined) data.maxUsers = maxUsers;
  if (name !== undefined) data.name = name;
  if (domain !== undefined) data.domain = domain || null;

  try {
    const tenant = await prisma.tenant.update({ where: { id }, data });
    return { tenant };
  } catch (err) {
    if (err.code === 'P2025') return reply.code(404).send({ error: 'Institution not found' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.delete('/api/v1/admin/tenants/:id', { preHandler: superAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  try {
    await prisma.tenant.delete({ where: { id } });
    return reply.code(204).send();
  } catch (err) {
    if (err.code === 'P2025') return reply.code(404).send({ error: 'Institution not found' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.get('/api/v1/admin/stats', { preHandler: superAdminOnly }, async (request, reply) => {
  try {
    const [totalTenants, activeTenants, totalUsers, starterCount, growthCount, enterpriseCount] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'active' } }),
        prisma.user.count({ where: { role: { not: 'superadmin' } } }),
        prisma.tenant.count({ where: { plan: 'starter' } }),
        prisma.tenant.count({ where: { plan: 'growth' } }),
        prisma.tenant.count({ where: { plan: 'enterprise' } }),
      ]);
    return { totalTenants, activeTenants, totalUsers, planBreakdown: { starter: starterCount, growth: growthCount, enterprise: enterpriseCount } };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

const PLATFORM_SETTINGS_KEY = 'platform:settings';
const DEFAULT_PLATFORM_SETTINGS = {
  name: 'UniChat Enterprise',
  supportEmail: 'support@unichat.io',
  maxTenantsDefault: '100',
  selfRegistration: false,
  publicTenantList: true,
  requireOtp: true,
  maintenanceMode: false,
  analyticsTracking: true,
  emailNotifications: true,
};

fastify.get('/api/v1/admin/settings', { preHandler: superAdminOnly }, async () => {
  const raw = await redis.get(PLATFORM_SETTINGS_KEY);
  if (raw) {
    try { return { settings: JSON.parse(raw) }; } catch (_) {}
  }
  return { settings: DEFAULT_PLATFORM_SETTINGS };
});

fastify.patch('/api/v1/admin/settings', { preHandler: superAdminOnly }, async (request, reply) => {
  const raw = await redis.get(PLATFORM_SETTINGS_KEY);
  const current = raw ? JSON.parse(raw) : { ...DEFAULT_PLATFORM_SETTINGS };
  const updated = { ...current, ...request.body };
  await redis.set(PLATFORM_SETTINGS_KEY, JSON.stringify(updated));
  return { settings: updated };
});

// ─────────────────────────────────────────────────────────────────
// Institution Admin — scoped to their tenant via JWT
// ─────────────────────────────────────────────────────────────────

// Get this admin's tenant + their own profile
fastify.get('/api/v1/institution/me', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId, userId } = request.user;
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { users: true, groups: true, faculties: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    }),
  ]);
  return { tenant, user };
});

// Branding
fastify.get('/api/v1/institution/branding', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.user.tenantId },
    select: { branding: true, name: true, slug: true, logoUrl: true },
  });
  return tenant;
});

fastify.patch('/api/v1/institution/branding', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { branding, logoUrl } = request.body || {};
  const data = {};
  if (branding !== undefined) data.branding = branding;
  if (logoUrl !== undefined) data.logoUrl = logoUrl;
  const tenant = await prisma.tenant.update({ where: { id: tenantId }, data });
  // Invalidate tenant cache in Redis
  await redis.del(`tenant:${tenant.slug}`);
  return { tenant };
});

// Settings
fastify.patch('/api/v1/institution/settings', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { settings } = request.body || {};
  const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: { settings } });
  return { tenant };
});

// Users
fastify.get('/api/v1/institution/users', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { role, search, page = '1', limit = '50' } = request.query || {};

  const where = {
    tenantId,
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      select: {
        id: true, fullName: true, email: true, phone: true, studentId: true,
        staffId: true, role: true, course: true, ntaLevel: true,
        department: { select: { id: true, name: true } },
        isActive: true, createdAt: true, lastLogin: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page: parseInt(page), limit: parseInt(limit) };
});

fastify.post('/api/v1/institution/users', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { fullName, email, phone, studentId, staffId, role, course, ntaLevel, departmentId } = request.body || {};
  if (!fullName) return reply.code(400).send({ error: 'Full name is required' });

  try {
    const user = await prisma.user.create({
      data: {
        tenantId, fullName, email: email || null, phone: phone || null,
        studentId: studentId || null, staffId: staffId || null, role: role || 'student',
        course: course || null, ntaLevel: ntaLevel || null, departmentId: departmentId || null, isActive: true,
      },
      select: {
        id: true, fullName: true, email: true, phone: true, studentId: true,
        staffId: true, role: true, course: true, ntaLevel: true,
        department: { select: { id: true, name: true } },
        isActive: true, createdAt: true,
      },
    });
    return reply.code(201).send({ user });
  } catch (err) {
    if (err.code === 'P2002') return reply.code(409).send({ error: 'A user with this ID or email already exists' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.patch('/api/v1/institution/users/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const {
    isActive, role, fullName, email, phone, studentId, staffId,
    course, ntaLevel, departmentId,
  } = request.body || {};

  if (role === 'superadmin' || role === 'admin') return reply.code(400).send({ error: 'Cannot set this role' });

  const data = {};
  if (isActive !== undefined) data.isActive = isActive;
  if (role) data.role = role;
  if (fullName) data.fullName = fullName;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (studentId !== undefined) data.studentId = studentId || null;
  if (staffId !== undefined) data.staffId = staffId || null;
  if (course !== undefined) data.course = course || null;
  if (ntaLevel !== undefined) data.ntaLevel = ntaLevel || null;
  if (departmentId !== undefined) data.departmentId = departmentId || null;

  let result;
  try {
    result = await prisma.user.updateMany({ where: { id, tenantId }, data });
  } catch (err) {
    if (err.code === 'P2002') return reply.code(409).send({ error: 'A user with this ID or email already exists' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
  if (result.count === 0) return reply.code(404).send({ error: 'User not found' });
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true, studentId: true,
      staffId: true, role: true, course: true, ntaLevel: true,
      department: { select: { id: true, name: true } }, isActive: true,
    },
  });
  return { user };
});

fastify.delete('/api/v1/institution/users/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId, userId } = request.user;
  if (id === userId) return reply.code(400).send({ error: 'Cannot delete your own account' });

  const result = await prisma.user.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return reply.code(404).send({ error: 'User not found' });
  return reply.code(204).send();
});

// Departments — faculties + departments hierarchy
fastify.get('/api/v1/institution/departments', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const faculties = await prisma.faculty.findMany({
    where: { tenantId },
    include: { departments: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  return { faculties };
});

fastify.post('/api/v1/institution/faculties', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { name, description } = request.body || {};
  if (!name) return reply.code(400).send({ error: 'Faculty name required' });
  const faculty = await prisma.faculty.create({ data: { tenantId, name, description: description || null } });
  return reply.code(201).send({ faculty });
});

fastify.delete('/api/v1/institution/faculties/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const result = await prisma.faculty.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return reply.code(404).send({ error: 'Faculty not found' });
  return reply.code(204).send();
});

fastify.post('/api/v1/institution/departments', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { name, facultyId } = request.body || {};
  if (!name || !facultyId) return reply.code(400).send({ error: 'Name and facultyId required' });
  const department = await prisma.department.create({ data: { tenantId, name, facultyId } });
  return reply.code(201).send({ department });
});

fastify.delete('/api/v1/institution/departments/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const result = await prisma.department.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return reply.code(404).send({ error: 'Department not found' });
  return reply.code(204).send();
});

// Clubs
fastify.get('/api/v1/institution/clubs', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const clubs = await prisma.group.findMany({
    where: { tenantId, type: 'club' },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return { clubs };
});

fastify.post('/api/v1/institution/clubs', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId, userId } = request.user;
  const { name, description } = request.body || {};
  if (!name) return reply.code(400).send({ error: 'Club name required' });
  const club = await prisma.group.create({
    data: { tenantId, name, description: description || null, type: 'club', createdBy: userId },
    include: { _count: { select: { members: true } } },
  });
  return reply.code(201).send({ club });
});

fastify.patch('/api/v1/institution/clubs/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const { name, description } = request.body || {};
  const data = {};
  if (name) data.name = name;
  if (description !== undefined) data.description = description;

  const result = await prisma.group.updateMany({ where: { id, tenantId, type: 'club' }, data });
  if (result.count === 0) return reply.code(404).send({ error: 'Club not found' });
  const club = await prisma.group.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  return { club };
});

fastify.delete('/api/v1/institution/clubs/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const result = await prisma.group.deleteMany({ where: { id, tenantId, type: 'club' } });
  if (result.count === 0) return reply.code(404).send({ error: 'Club not found' });
  return reply.code(204).send();
});

// Courses — catalog under a department; teachers pick from these when
// registering what they teach.
fastify.get('/api/v1/institution/courses', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const courses = await prisma.course.findMany({
    where: { tenantId },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return { courses };
});

fastify.post('/api/v1/institution/courses', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { name, departmentId } = request.body || {};
  if (!name || !departmentId) return reply.code(400).send({ error: 'Name and departmentId are required' });
  try {
    const course = await prisma.course.create({
      data: { tenantId, name, departmentId },
      include: { department: { select: { id: true, name: true } } },
    });
    return reply.code(201).send({ course });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.delete('/api/v1/institution/courses/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;
  const result = await prisma.course.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return reply.code(404).send({ error: 'Course not found' });
  return reply.code(204).send();
});

// Bulk import — paste a whole faculty/department/programme table at once
// instead of adding each one by hand. Idempotent: matches existing
// faculties/departments by name and only creates what's missing, same
// logic as infrastructure/database/seed-programmes.js.
fastify.post('/api/v1/institution/bulk-import', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { rows } = request.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return reply.code(400).send({ error: 'rows array is required' });
  }

  let facultiesCreated = 0, departmentsCreated = 0, programmesCreated = 0, programmesSkipped = 0;
  const errors = [];

  for (const row of rows) {
    const facultyName = (row.faculty || '').trim();
    const deptName = (row.department || '').trim();
    const programmeNames = (row.programmes || '')
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!facultyName || !deptName) {
      errors.push(`Skipped — faculty and department are required: ${JSON.stringify(row)}`);
      continue;
    }

    try {
      let faculty = await prisma.faculty.findFirst({ where: { tenantId, name: facultyName } });
      if (!faculty) {
        faculty = await prisma.faculty.create({ data: { tenantId, name: facultyName } });
        facultiesCreated++;
      }

      let department = await prisma.department.findFirst({ where: { tenantId, facultyId: faculty.id, name: deptName } });
      if (!department) {
        department = await prisma.department.create({ data: { tenantId, facultyId: faculty.id, name: deptName } });
        departmentsCreated++;
      }

      for (const programmeName of programmeNames) {
        const existing = await prisma.course.findFirst({ where: { tenantId, departmentId: department.id, name: programmeName } });
        if (existing) { programmesSkipped++; continue; }
        await prisma.course.create({ data: { tenantId, departmentId: department.id, name: programmeName } });
        programmesCreated++;
      }
    } catch (err) {
      fastify.log.error(err);
      errors.push(`Failed on "${facultyName} / ${deptName}": ${err.message}`);
    }
  }

  return { facultiesCreated, departmentsCreated, programmesCreated, programmesSkipped, errors };
});

// ─────────────────────────────────────────────────────────────────
// Teacher — self-service: profile, course/NTA-level assignments, and
// picking a Class Rep (CR) per assignment. Being CR grants the student
// group/club creation rights app-wide, so promotion/demotion here is the
// single source of truth for that role — a student stays 'class_rep' only
// as long as they hold at least one CR assignment.
// ─────────────────────────────────────────────────────────────────
async function demoteIfOrphanedCr(studentId, tenantId) {
  const stillCr = await prisma.teacherAssignment.findFirst({ where: { crUserId: studentId, tenantId } });
  if (stillCr) return;
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true } });
  if (student?.role === 'class_rep') {
    await prisma.user.update({ where: { id: studentId }, data: { role: 'student' } });
  }
}

const ASSIGNMENT_INCLUDE = {
  course: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
  cr: { select: { id: true, fullName: true, studentId: true, phone: true } },
};

fastify.get('/api/v1/teacher/me', { preHandler: teacherOnly }, async (request, reply) => {
  const { userId, tenantId } = request.user;
  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, phone: true, role: true,
      department: { select: { id: true, name: true } },
    },
  });
  if (!teacher) return reply.code(404).send({ error: 'Teacher not found' });

  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId: userId, tenantId },
    include: ASSIGNMENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return { teacher, assignments };
});

fastify.get('/api/v1/teacher/courses', { preHandler: teacherOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const courses = await prisma.course.findMany({
    where: { tenantId },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return { courses };
});

fastify.post('/api/v1/teacher/assignments', { preHandler: teacherOnly }, async (request, reply) => {
  const { userId, tenantId } = request.user;
  const { courseId, ntaLevel } = request.body || {};
  if (!courseId || !ntaLevel) return reply.code(400).send({ error: 'courseId and ntaLevel are required' });

  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId } });
  if (!course) return reply.code(404).send({ error: 'Course not found' });

  try {
    const assignment = await prisma.teacherAssignment.create({
      data: { tenantId, teacherId: userId, courseId, ntaLevel: ntaLevel.trim() },
      include: ASSIGNMENT_INCLUDE,
    });
    return reply.code(201).send({ assignment });
  } catch (err) {
    if (err.code === 'P2002') return reply.code(409).send({ error: 'You already teach this course at this NTA level' });
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.delete('/api/v1/teacher/assignments/:id', { preHandler: teacherOnly }, async (request, reply) => {
  const { id } = request.params;
  const { userId, tenantId } = request.user;

  const assignment = await prisma.teacherAssignment.findFirst({ where: { id, teacherId: userId, tenantId } });
  if (!assignment) return reply.code(404).send({ error: 'Assignment not found' });

  await prisma.teacherAssignment.delete({ where: { id } });
  if (assignment.crUserId) await demoteIfOrphanedCr(assignment.crUserId, tenantId);

  return reply.code(204).send();
});

// Class Rep candidates — students (or existing CRs, so a teacher can see who
// currently holds it) in the same institution.
fastify.get('/api/v1/teacher/students', { preHandler: teacherOnly }, async (request, reply) => {
  const { tenantId } = request.user;
  const { search = '', limit = '20' } = request.query || {};
  const students = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['student', 'class_rep'] },
      isActive: true,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { studentId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, fullName: true, studentId: true, course: true, ntaLevel: true, role: true },
    orderBy: { fullName: 'asc' },
    take: parseInt(limit),
  });
  return { students };
});

fastify.post('/api/v1/teacher/assignments/:id/cr', { preHandler: teacherOnly }, async (request, reply) => {
  const { id } = request.params;
  const { userId, tenantId } = request.user;
  const { studentUserId } = request.body || {};
  if (!studentUserId) return reply.code(400).send({ error: 'studentUserId is required' });

  const assignment = await prisma.teacherAssignment.findFirst({ where: { id, teacherId: userId, tenantId } });
  if (!assignment) return reply.code(404).send({ error: 'Assignment not found' });

  const student = await prisma.user.findFirst({
    where: { id: studentUserId, tenantId, role: { in: ['student', 'class_rep'] } },
  });
  if (!student) return reply.code(404).send({ error: 'Student not found' });

  const previousCrId = assignment.crUserId;

  await prisma.$transaction([
    prisma.teacherAssignment.update({ where: { id }, data: { crUserId: studentUserId } }),
    prisma.user.update({ where: { id: studentUserId }, data: { role: 'class_rep' } }),
  ]);
  if (previousCrId && previousCrId !== studentUserId) {
    await demoteIfOrphanedCr(previousCrId, tenantId);
  }

  const updated = await prisma.teacherAssignment.findUnique({ where: { id }, include: ASSIGNMENT_INCLUDE });
  return { assignment: updated };
});

fastify.delete('/api/v1/teacher/assignments/:id/cr', { preHandler: teacherOnly }, async (request, reply) => {
  const { id } = request.params;
  const { userId, tenantId } = request.user;

  const assignment = await prisma.teacherAssignment.findFirst({ where: { id, teacherId: userId, tenantId } });
  if (!assignment) return reply.code(404).send({ error: 'Assignment not found' });
  if (!assignment.crUserId) return reply.code(204).send();

  const previousCrId = assignment.crUserId;
  await prisma.teacherAssignment.update({ where: { id }, data: { crUserId: null } });
  await demoteIfOrphanedCr(previousCrId, tenantId);

  return reply.code(204).send();
});

// ─────────────────────────────────────────────────────────────────
// Institution Admin — read-only visibility + override control over every
// teacher's course/NTA-level assignments and Class Rep picks, institution-
// wide (teachers only ever see/manage their own via /api/v1/teacher/*).
// ─────────────────────────────────────────────────────────────────
fastify.get('/api/v1/institution/assignments', { preHandler: institutionAdminOnly }, async (request) => {
  const { tenantId } = request.user;
  const assignments = await prisma.teacherAssignment.findMany({
    where: { tenantId },
    include: {
      teacher: { select: { id: true, fullName: true, email: true, phone: true } },
      ...ASSIGNMENT_INCLUDE,
    },
    orderBy: { createdAt: 'desc' },
  });
  return { assignments };
});

fastify.delete('/api/v1/institution/assignments/:id', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;

  const assignment = await prisma.teacherAssignment.findFirst({ where: { id, tenantId } });
  if (!assignment) return reply.code(404).send({ error: 'Assignment not found' });

  await prisma.teacherAssignment.delete({ where: { id } });
  if (assignment.crUserId) await demoteIfOrphanedCr(assignment.crUserId, tenantId);

  return reply.code(204).send();
});

fastify.delete('/api/v1/institution/assignments/:id/cr', { preHandler: institutionAdminOnly }, async (request, reply) => {
  const { id } = request.params;
  const { tenantId } = request.user;

  const assignment = await prisma.teacherAssignment.findFirst({ where: { id, tenantId } });
  if (!assignment) return reply.code(404).send({ error: 'Assignment not found' });
  if (!assignment.crUserId) return reply.code(204).send();

  const previousCrId = assignment.crUserId;
  await prisma.teacherAssignment.update({ where: { id }, data: { crUserId: null } });
  await demoteIfOrphanedCr(previousCrId, tenantId);

  return reply.code(204).send();
});

// ─────────────────────────────────────────────────────────────────
// Student / Staff — data endpoints (any tenant-scoped bearer token)
// ─────────────────────────────────────────────────────────────────
const bearerAuth = async (request, reply) => {
  try {
    await request.jwtVerify();
    if (!request.user.tenantId)
      return reply.code(403).send({ error: 'No tenant scope' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

// Rooms — all groups the user belongs to, with last message preview
fastify.get('/api/v1/student/rooms', { preHandler: bearerAuth }, async (request) => {
  const { userId, tenantId } = request.user;

  const groups = await prisma.group.findMany({
    where: { tenantId, members: { some: { userId } } },
    include: {
      _count: { select: { members: true } },
      members: {
        include: { user: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { fullName: true, avatarUrl: true } } },
      },
    },
  });

  groups.sort((a, b) => {
    const at = a.messages[0]?.createdAt ?? a.createdAt;
    const bt = b.messages[0]?.createdAt ?? b.createdAt;
    return new Date(bt) - new Date(at);
  });

  // Count unread messages per room. Each room compares against its own
  // lastReadAt, which a single Prisma groupBy can't express — hence raw SQL.
  // Every column here is camelCase because Prisma created them that way; the
  // identifiers must stay quoted or Postgres will fold them to lowercase.
  const groupIds = groups.map(g => g.id);
  let unreadRows = [];
  if (groupIds.length > 0) {
    const placeholders = groupIds.map((_, i) => `$${i + 2}::uuid`).join(', ');
    unreadRows = await prisma.$queryRawUnsafe(
      `SELECT m."groupId"::text AS "groupId", COUNT(m.id)::int AS "count"
       FROM messages m
       JOIN group_members gm ON gm."groupId" = m."groupId" AND gm."userId" = $1::uuid
       WHERE m."groupId" IN (${placeholders})
         AND m."senderId" != $1::uuid
         AND gm."lastReadAt" IS NOT NULL
         AND m."createdAt" > gm."lastReadAt"
       GROUP BY m."groupId"`,
      userId,
      ...groupIds
    );
  }
  const unreadMap = Object.fromEntries(unreadRows.map(r => [r.groupId, Number(r.count)]));

  return {
    rooms: groups.map(g => {
      let displayName = g.name;
      let subtitle = `${g._count.members} members`;
      if (g.type === 'private') {
        const other = g.members.find(m => m.userId !== userId);
        if (other) {
          displayName = other.user.fullName;
          const r = other.user.role;
          subtitle = (r === 'teacher' || r === 'staff') ? 'Teacher'
            : r === 'admin' ? 'Admin' : 'Student';
        }
      }
      // For DMs: use the other user's avatar. For groups: no room-level avatar yet.
      const other = g.type === 'private'
        ? g.members.find(m => m.userId !== userId)
        : null;

      return {
        id: g.id,
        name: displayName,
        type: g.type,
        memberCount: g._count.members,
        subtitle,
        avatarUrl: other?.user?.avatarUrl ?? null,            // DM partner's photo
        lastMessage: g.messages[0]?.content ?? '',
        // Media stores its URL in content, so the client needs the type to show
        // a label instead of printing the raw upload path in the chat list.
        lastMessageType: g.messages[0]?.type ?? 'text',
        lastSenderName: g.type === 'private' ? '' : (g.messages[0]?.sender?.fullName ?? ''),
        lastSenderId: g.messages[0]?.senderId ?? null,
        lastSenderAvatar: g.messages[0]?.sender?.avatarUrl ?? null,
        lastMessageAt: (g.messages[0]?.createdAt ?? g.createdAt).toISOString(),
        unreadCount: unreadMap[g.id] ?? 0,
      };
    }),
  };
});

// Mark a room as read
fastify.patch('/api/v1/student/rooms/:roomId/read', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId } = request.user;
  const { roomId } = request.params;
  try {
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: roomId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  } catch (e) {
    if (e.code === 'P2025') return reply.code(404).send({ error: 'Room not found' });
    fastify.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

// Clubs — all clubs in the tenant + whether the user has joined
fastify.get('/api/v1/student/clubs', { preHandler: bearerAuth }, async (request) => {
  const { userId, tenantId } = request.user;

  const clubs = await prisma.group.findMany({
    where: { tenantId, type: 'club' },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId } },
    },
    orderBy: { name: 'asc' },
  });

  return {
    clubs: clubs.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      memberCount: c._count.members,
      isJoined: c.members.length > 0,
    })),
  };
});

// Search users in the same institution (for DMs)
fastify.get('/api/v1/student/users', { preHandler: bearerAuth }, async (request) => {
  const { userId, tenantId } = request.user;
  const { search = '', limit = '30' } = request.query || {};

  const where = {
    tenantId,
    id: { not: userId },
    isActive: true,
    ...(search.trim()
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, fullName: true, role: true, studentId: true, email: true },
    take: parseInt(limit),
    orderBy: { fullName: 'asc' },
  });

  return { users };
});

// Find or create a private DM room between two users
fastify.post('/api/v1/student/rooms/dm', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId } = request.user;
  const { targetUserId } = request.body || {};

  if (!targetUserId) return reply.code(400).send({ error: 'targetUserId required' });
  if (targetUserId === userId) return reply.code(400).send({ error: 'Cannot DM yourself' });

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId, isActive: true },
    select: { id: true, fullName: true },
  });
  if (!target) return reply.code(404).send({ error: 'User not found' });

  // Find existing DM: private group the current user is in that also has the target
  const candidates = await prisma.group.findMany({
    where: { tenantId, type: 'private', members: { some: { userId } } },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: targetUserId } },
    },
  });
  const existing = candidates.find(g => g._count.members === 2 && g.members.length > 0);

  if (existing) {
    return { room: { id: existing.id, name: target.fullName, type: 'private' } };
  }

  const room = await prisma.group.create({
    data: {
      tenantId,
      name: `dm:${[userId, targetUserId].sort().join(':')}`,
      type: 'private',
      createdBy: userId,
      members: { create: [{ userId }, { userId: targetUserId }] },
    },
  });

  return reply.code(201).send({ room: { id: room.id, name: target.fullName, type: 'private' }, created: true });
});

// ─────────────────────────────────────────────────────────────────
// Create a general group room (class rep / teacher / admin)
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/student/rooms/group', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId, role } = request.user;
  const allowed = ['teacher','lecturer','staff','admin','class_rep'];
  if (!allowed.includes(role)) return reply.code(403).send({ error: 'Only teachers and class reps can create groups' });

  const { name, description, memberIds = [] } = request.body || {};
  if (!name?.trim()) return reply.code(400).send({ error: 'Group name is required' });

  const group = await prisma.group.create({
    data: {
      tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      type: 'group',
      createdBy: userId,
      members: {
        create: [
          { userId },
          ...memberIds
            .filter(id => id !== userId)
            .map(id => ({ userId: id })),
        ],
      },
    },
  });

  fastify.log.info(`[GROUP CREATED] "${group.name}" by ${userId}`);
  return reply.code(201).send({ room: { id: group.id, name: group.name, type: 'group' } });
});

// ─────────────────────────────────────────────────────────────────
// Create an academic room (cohort / course) — teacher / admin only
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/student/rooms/academic', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId, role } = request.user;
  const allowed = ['teacher','lecturer','staff','admin'];
  if (!allowed.includes(role)) return reply.code(403).send({ error: 'Only teachers and admins can create academic groups' });

  const { name, description, type = 'course', memberIds = [] } = request.body || {};
  if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' });
  if (!['cohort','course'].includes(type)) return reply.code(400).send({ error: 'Type must be cohort or course' });

  const group = await prisma.group.create({
    data: {
      tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      type,
      createdBy: userId,
      members: {
        create: [
          { userId },
          ...memberIds.filter(id => id !== userId).map(id => ({ userId: id })),
        ],
      },
    },
  });

  fastify.log.info(`[ACADEMIC CREATED] ${type} "${group.name}" by ${userId}`);
  return reply.code(201).send({ room: { id: group.id, name: group.name, type: group.type } });
});

// ─────────────────────────────────────────────────────────────────
// Create a club — teacher / admin only
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/student/clubs', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId, role } = request.user;
  const allowed = ['teacher','lecturer','staff','admin'];
  if (!allowed.includes(role)) return reply.code(403).send({ error: 'Only teachers and admins can create clubs' });

  const { name, description, category = 'General' } = request.body || {};
  if (!name?.trim()) return reply.code(400).send({ error: 'Club name is required' });

  const existing = await prisma.group.findFirst({ where: { tenantId, name: name.trim(), type: 'club' } });
  if (existing) return reply.code(409).send({ error: 'A club with that name already exists' });

  const club = await prisma.group.create({
    data: {
      tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      type: 'club',
      createdBy: userId,
      members: { create: [{ userId }] },
    },
  });

  fastify.log.info(`[CLUB CREATED] "${club.name}" (${category}) by ${userId}`);
  return reply.code(201).send({ club: { id: club.id, name: club.name, type: 'club', category } });
});

// Join a club
fastify.post('/api/v1/student/clubs/:id/join', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId } = request.user;
  const { id } = request.params;
  const club = await prisma.group.findFirst({ where: { id, tenantId, type: 'club' } });
  if (!club) return reply.code(404).send({ error: 'Club not found' });
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: id, userId } },
    create: { groupId: id, userId },
    update: {},
  });
  return { ok: true };
});

// Leave a club
fastify.delete('/api/v1/student/clubs/:id/leave', { preHandler: bearerAuth }, async (request, reply) => {
  const { userId, tenantId } = request.user;
  const { id } = request.params;
  await prisma.groupMember.deleteMany({ where: { groupId: id, userId } });
  return reply.code(204).send();
});

// ─────────────────────────────────────────────────────────────────
// Student / Staff — OTP auth
// ─────────────────────────────────────────────────────────────────
fastify.post('/api/v1/auth/register', async (request, reply) => {
  const { fullName, email, tenantSlug, studentId, departmentId, cohortId } = request.body;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });

  const user = await prisma.user.create({
    data: { fullName, email, tenantId: tenant.id, studentId, role: 'student' },
  });

  await producer.send({
    topic: 'user_registered',
    messages: [{ value: JSON.stringify({ user, academicInfo: { departmentId, cohortId } }) }],
  });
  return { message: 'User registered and enrollment triggered', user };
});

fastify.post('/api/v1/auth/request-otp', async (request, reply) => {
  const { identifier, tenantSlug } = request.body;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return reply.code(404).send({ error: 'Institution not found' });

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [{ email: identifier }, { studentId: identifier }, { staffId: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'User not registered in this institution' });

  const otp = otpService.generateOtp();
  await redis.set(`otp:${tenant.id}:${user.id}`, otp, 'EX', 300);

  // Deliver by SMS when the user has a phone and SMS is configured. Only log
  // the code when it could NOT be sent, so a real deployment doesn't leak
  // every OTP into the logs while dev/testing still has a way to read it.
  const sms = await smsService.sendOtp(user.phone, otp);
  if (sms.sent) {
    fastify.log.info(`[OTP] ${user.fullName}: sent via SMS to ${smsService.maskPhone(user.phone)}`);
  } else {
    fastify.log.info(`[OTP] ${user.fullName} (${identifier}): ${otp}  [sms: ${sms.reason || sms.error}]`);
  }

  return {
    message: 'OTP sent successfully',
    target: sms.sent ? 'sms' : (user.email ? 'email' : 'phone'),
    user: { fullName: user.fullName },
  };
});

fastify.post('/api/v1/auth/verify-otp', async (request, reply) => {
  const { identifier, tenantSlug, otp } = request.body;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [{ email: identifier }, { studentId: identifier }, { staffId: identifier }],
    },
  });
  if (!user) return reply.code(404).send({ error: 'User not found' });

  const redisKey = `otp:${tenant.id}:${user.id}`;
  const storedOtp = await redis.get(redisKey);
  if (!storedOtp) return reply.code(400).send({ error: 'OTP expired or not requested' });
  if (storedOtp !== otp) return reply.code(400).send({ error: 'Invalid OTP' });

  await redis.del(redisKey);
  const token = fastify.jwt.sign({ userId: user.id, tenantId: tenant.id, role: user.role });
  return { token, user: { id: user.id, fullName: user.fullName, role: user.role, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } } };
});

// ─────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await producer.connect();
    await fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
