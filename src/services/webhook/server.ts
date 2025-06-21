import express, { Request, Response, RequestHandler } from 'express';
import crypto from 'crypto';
import { connectProducer, getProducer, disconnectProducer } from '../../common/kafka';
import { SourceType } from '../../common/types';
import { webhookHandlerRegistry, WebhookContext } from './handlers';

const app = express();
const port = process.env.PORT || 3000;

const KAFKA_TOPIC = 'feedback-ingestion';

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).send({ status: 'ok' });
});

// Get webhook handler information
app.get('/webhooks/info', (req: Request, res: Response) => {
  const handlersInfo = webhookHandlerRegistry.getHandlerInfo();
  res.status(200).json({
    message: 'Webhook handlers information',
    handlers: handlersInfo,
    supported_source_types: Object.values(SourceType)
  });
});

// Generic webhook handler function
const handleGenericWebhook: RequestHandler = async (req, res) => {
    const { source_type, tenant_id } = req.params;
    const correlationId = crypto.randomUUID();

    console.log(`[${correlationId}] Received webhook for tenant: ${tenant_id}, source: ${source_type}`);
    
    // Validate source type
    if (!webhookHandlerRegistry.isSourceTypeSupported(source_type)) {
        console.error(`[${correlationId}] Unsupported source type: ${source_type}`);
        res.status(400).json({ 
            message: 'Unsupported source type', 
            supported_types: Object.values(SourceType),
            correlation_id: correlationId 
        });
        return;
    }

    try {
        const sourceType = source_type as SourceType;
        
        // Get the appropriate handler for this source type
        const handler = webhookHandlerRegistry.getHandler(sourceType);
        
        // Create webhook context
        const context: WebhookContext = {
            tenantId: tenant_id,
            sourceType,
            request: req,
            correlationId
        };
        
        // Process the webhook using the handler
        const result = await handler.processWebhook(context);
        
        if (!result.isValid) {
            console.error(`[${correlationId}] Webhook validation failed: ${result.errorMessage}`);
            res.status(400).json({ 
                message: 'Webhook validation failed', 
                error: result.errorMessage,
                correlation_id: correlationId 
            });
            return;
        }

        // Create the message for Kafka
        const message = {
            tenant_id,
            source_type: sourceType,
            source_config: result.sourceConfig,
            ingestion_method: 'WEBHOOK' as const,
            raw_data: result.rawData,
            retry_count: 0,
            correlation_id: correlationId
        };

        // Send to Kafka
        const producer = getProducer();
        await producer.send({
            topic: KAFKA_TOPIC,
            messages: [{ value: JSON.stringify(message) }],
        });

        console.log(`[${correlationId}] Message successfully sent to Kafka topic: ${KAFKA_TOPIC} using ${handler.getDisplayName()}`);
        res.status(202).send({ 
            message: 'Accepted', 
            correlation_id: correlationId,
            handler_used: handler.getDisplayName()
        });
        
    } catch (error) {
        console.error(`[${correlationId}] Failed to process webhook:`, error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            correlation_id: correlationId 
        });
    }
};

// Generic webhook endpoint that accepts any source type
app.post('/webhooks/:source_type/:tenant_id', handleGenericWebhook);

const startServer = async () => {
    await connectProducer();
    
    app.listen(port, () => {
        console.log(`Webhook receiver service listening on port ${port}`);
    });

    process.on('SIGTERM', async () => {
        console.log('SIGTERM signal received: closing HTTP server and disconnecting Kafka producer');
        await disconnectProducer();
        process.exit(0);
    });
};

startServer().catch(console.error); 