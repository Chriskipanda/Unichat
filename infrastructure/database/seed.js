const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Initial Tenant (Arusha Technical College)
  const atc = await prisma.tenant.upsert({
    where: { slug: 'atc' },
    update: {
      plan: 'growth',
      status: 'active',
      maxUsers: 5000,
    },
    create: {
      name: 'Arusha Technical College',
      slug: 'atc',
      domain: 'atc.ac.tz',
      plan: 'growth',
      status: 'active',
      maxUsers: 5000,
      branding: {
        primaryColor: '#FBBC05',
        secondaryColor: '#0F172A',
      },
      settings: {
        allowSelfRegistration: false,
        requireOtp: true,
      },
    },
  });
  console.log(`Tenant: ${atc.name} (${atc.plan})`);

  // 2. Create ATC Institution Admin (tenant-scoped)
  const adminExists = await prisma.user.findFirst({
    where: { tenantId: atc.id, email: 'admin@atc.ac.tz' },
  });
  if (!adminExists) {
    const adminHash = await bcrypt.hash('ATCAdmin@2026!', 12);
    const admin = await prisma.user.create({
      data: {
        tenantId: atc.id,
        email: 'admin@atc.ac.tz',
        fullName: 'ATC System Administrator',
        role: 'admin',
        passwordHash: adminHash,
        isActive: true,
      },
    });
    console.log(`Institution admin: ${admin.fullName}`);
  } else {
    console.log('Institution admin already exists');
  }

  // 3. Create SuperAdmin (platform-level, no tenant)
  const superAdminExists = await prisma.user.findFirst({
    where: { email: 'superadmin@unichat.io', tenantId: null },
  });
  if (!superAdminExists) {
    const hash = await bcrypt.hash('SuperAdmin@2026!', 12);
    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: 'superadmin@unichat.io',
        fullName: 'UniChat Platform Admin',
        role: 'superadmin',
        passwordHash: hash,
        isActive: true,
      },
    });
    console.log(`SuperAdmin created: ${superAdmin.email}`);
  } else {
    console.log('SuperAdmin already exists');
  }

  // 4. Two ATC students. Testing chat needs two accounts — one can't DM itself
  // — and students sign in with an OTP, so they carry no password.
  const students = [
    { fullName: 'Test Student',   email: 'student@atc.ac.tz',  studentId: 'ATC-2026-001' },
    { fullName: 'Second Student', email: 'student2@atc.ac.tz', studentId: 'ATC-2026-002' },
  ];
  for (const s of students) {
    const exists = await prisma.user.findFirst({
      where: { tenantId: atc.id, email: s.email },
    });
    if (!exists) {
      await prisma.user.create({
        data: { ...s, tenantId: atc.id, role: 'student', isActive: true },
      });
      console.log(`Student created: ${s.fullName} (${s.studentId})`);
    } else {
      console.log(`Student already exists: ${s.fullName}`);
    }
  }

  // The ATC admin gets a passwordHash above, but no endpoint accepts it:
  // /auth/admin/login only matches role 'superadmin'. It signs in by OTP.
  console.log('\nSeed complete.');
  console.log('  SuperAdmin → superadmin@unichat.io / SuperAdmin@2026!   (password, at /login)');
  console.log('  ATC Admin  → admin@atc.ac.tz                            (OTP, at /admin-login)');
  console.log('  Students   → student@atc.ac.tz, student2@atc.ac.tz      (OTP, mobile app)');
  console.log('  OTP codes are printed by auth-service: docker logs -f unichat-auth-service');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
