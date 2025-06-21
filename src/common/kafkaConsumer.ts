import { Kafka, Consumer } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'feedback-processing-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
});

const consumer: Consumer = kafka.consumer({ groupId: 'feedback-processing-group' });

export const connectConsumer = async () => {
  await consumer.connect();
  console.log('Kafka consumer connected');
};

export const disconnectConsumer = async () => {
  await consumer.disconnect();
  console.log('Kafka consumer disconnected');
};

export const getConsumer = (): Consumer => {
  return consumer;
}; 