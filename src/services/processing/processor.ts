import { connectConsumer, disconnectConsumer, getConsumer } from '../../common/kafkaConsumer';
import { connectDatabase, disconnectDatabase } from '../../common/database';
import { Feedback } from '../../models/feedback';
import { transformFeedbackData, QueueMessage } from './transformers';
import { generateIdempotencyFilter } from './filters';

const KAFKA_TOPIC = 'feedback-ingestion';
const MAX_RETRIES = 3;

class FeedbackProcessor {
  private isRunning = false;

  async start() {
    console.log('Starting Feedback Processing Service...');
    
    // Connect to dependencies
    await connectDatabase();
    await connectConsumer();
    
    const consumer = getConsumer();
    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });
    
    this.isRunning = true;
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!this.isRunning) return;
        
        let parsedMessage: QueueMessage | undefined;
        let correlationId = 'unknown';
        
        try {
          if (!message.value) {
            console.error('Received empty message');
            return;
          }
          
          parsedMessage = JSON.parse(message.value.toString());
          if (!parsedMessage) {
            console.error('Failed to parse message');
            return;
          }
          
          correlationId = parsedMessage.correlation_id;
          console.log(`[${correlationId}] Processing message for tenant: ${parsedMessage.tenant_id}`);
          
          await this.processMessage(parsedMessage);
          
        } catch (error) {
          console.error(`[${correlationId}] Error processing message:`, error);
          
          // In a production system, you would implement retry logic here
          // and send to DLQ after max retries
          if (parsedMessage && parsedMessage.retry_count < MAX_RETRIES) {
            console.log(`[${parsedMessage.correlation_id}] Retrying message (attempt ${parsedMessage.retry_count + 1})`);
            // TODO: Implement retry by republishing to Kafka with incremented retry_count
          } else {
            console.error(`[${correlationId}] Max retries exceeded, sending to DLQ`);
            // TODO: Send to Dead Letter Queue
          }
        }
      },
    });
    
    console.log('Feedback Processing Service started and listening for messages...');
  }

  async processMessage(message: QueueMessage): Promise<void> {
    try {
      // Transform the raw data based on source type
      const transformedData = transformFeedbackData(message);
      
      // Generate source-specific idempotency filter
      const filter = generateIdempotencyFilter(message);
      
      console.log(`[${message.correlation_id}] Using filter for ${message.source_type}:`, JSON.stringify(filter, null, 2));
      
      const result = await Feedback.findOneAndUpdate(
        filter,
        transformedData,
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true
        }
      );
      
      console.log(`[${message.correlation_id}] Successfully processed feedback record:`, result._id);
      
    } catch (error) {
      console.error(`[${message.correlation_id}] Error processing message:`, error);
      throw error;
    }
  }

  async stop() {
    console.log('Stopping Feedback Processing Service...');
    this.isRunning = false;
    
    await disconnectConsumer();
    await disconnectDatabase();
    
    console.log('Feedback Processing Service stopped');
  }
}

// Create and export processor instance
const processor = new FeedbackProcessor();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received');
  await processor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received');
  await processor.stop();
  process.exit(0);
});

// Start the processor
processor.start().catch((error) => {
  console.error('Failed to start processor:', error);
  process.exit(1);
});

export default processor; 