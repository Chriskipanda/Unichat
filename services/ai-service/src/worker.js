const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'ai-service-worker',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'ai-moderation-group' });
const producer = kafka.producer();

const run = async () => {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'message_sent', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      console.log(`[AI Moderation] Scanning message: ${payload.id}`);

      // MOCK AI LOGIC (In production, call OpenAI Moderation API or a local LLM)
      const toxicWords = ['spam', 'abuse', 'hack'];
      const isHarmful = toxicWords.some(word => payload.content.toLowerCase().includes(word));

      if (isHarmful) {
        console.warn(`[AI Moderation] HARMFUL CONTENT DETECTED: ${payload.id}`);

        // Emit a moderation alert event
        await producer.send({
          topic: 'moderation_alerts',
          messages: [{
            value: JSON.stringify({
              messageId: payload.id,
              tenantId: payload.tenantId,
              reason: 'Toxic content detected by AI',
              content: payload.content,
              timestamp: new Date()
            })
          }]
        });
      }
    },
  });
};

run().catch(console.error);
