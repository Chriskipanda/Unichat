const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const kafka = new Kafka({
  clientId: 'community-service-worker',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'enrollment-group' });

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'user_registered', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const { user, academicInfo } = JSON.parse(message.value.toString());
      console.log(`[Enrollment] Processing enrollment for user: ${user.id} (${user.fullName})`);

      const { tenantId } = user;
      const { facultyId, departmentId, cohortId } = academicInfo;

      const groupIdsToJoin = [];

      // 1. Logic to find or create group for Cohort
      if (cohortId) {
        const cohortGroup = await findOrCreateAcademicGroup(tenantId, 'cohort', cohortId);
        if (cohortGroup) groupIdsToJoin.push(cohortGroup.id);
      }

      // 2. Logic to find or create group for Department
      if (departmentId) {
        const deptGroup = await findOrCreateAcademicGroup(tenantId, 'department', departmentId);
        if (deptGroup) groupIdsToJoin.push(deptGroup.id);
      }

      // 3. Institution-wide announcements
      const mainGroup = await findOrCreateAcademicGroup(tenantId, 'announcement', tenantId);
      if (mainGroup) groupIdsToJoin.push(mainGroup.id);

      // Join all identified groups
      for (const groupId of groupIdsToJoin) {
        try {
          await prisma.groupMember.upsert({
            where: {
              groupId_userId: { groupId, userId: user.id }
            },
            update: {},
            create: {
              groupId,
              userId: user.id,
              role: 'member'
            }
          });
          console.log(`[Enrollment] User ${user.id} joined group ${groupId}`);
        } catch (err) {
          console.error(`[Enrollment] Failed to join group ${groupId}:`, err.message);
        }
      }
    },
  });
};

async function findOrCreateAcademicGroup(tenantId, type, contextId) {
  // Try to find an existing group for this academic context
  let group = await prisma.group.findFirst({
    where: { tenantId, type, academicContextId: contextId }
  });

  if (!group) {
    // Create it if it doesn't exist (e.g. first student in the cohort)
    // In a real system, these might be pre-created by the admin
    const nameMap = {
      'cohort': 'Academic Cohort Group',
      'department': 'Department Discussion',
      'announcement': 'Institutional Announcements'
    };

    group = await prisma.group.create({
      data: {
        tenantId,
        type,
        academicContextId: contextId,
        name: nameMap[type] || 'Unnamed Group',
        description: `Automated academic group for ${type}`,
      }
    });
  }
  return group;
}

run().catch(console.error);
