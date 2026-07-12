const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const kafka = new Kafka({
  clientId: 'messaging-persistence',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'persistence-group' });

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'message_sent', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      console.log(`[Persistence] Saving message from ${payload.senderId} in room ${payload.roomId}`);

      try {
        await prisma.message.create({
          data: {
            id: payload.id,
            tenantId: payload.tenantId,
            groupId: payload.roomId, // Assuming roomId is the groupId UUID
            senderId: payload.senderId,
            content: payload.content,
            createdAt: payload.createdAt,
          }
        });
      } catch (err) {
        console.error('[Persistence] Error saving message:', err.message);
      }
    },
  });
};

run().catch(console.error);
