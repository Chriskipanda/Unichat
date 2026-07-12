const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service-worker',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'message_sent', fromBeginning: true });
  await consumer.subscribe({ topic: 'moderation_alerts', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());

      if (topic === 'message_sent') {
        console.log(`[Notification] Sending push for message in room: ${payload.roomId}`);
        // MOCK: Integration with Firebase Cloud Messaging (FCM)
      }

      if (topic === 'moderation_alerts') {
        console.log(`[Notification] ALERT: High-priority admin notification for moderation: ${payload.reason}`);
        // MOCK: Send SMS to Admin via Africa's Talking
      }
    },
  });
};

run().catch(console.error);
