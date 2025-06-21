import { Kafka, Producer } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'feedback-ingestion-system',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
});

const producer: Producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log('Kafka producer connected');
};

export const disconnectProducer = async () => {
    await producer.disconnect();
    console.log('Kafka producer disconnected');
};

export const getProducer = (): Producer => {
    return producer;
}; 