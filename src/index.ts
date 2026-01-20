import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { DatabaseService } from './services/DatabaseService';
import { RedisService } from './services/RedisService';
import { authRoutes } from './routes/auth';
import { accountRoutes } from './routes/accounts';
import { analyticsRoutes } from './routes/analytics';
import { chatbotRoutes } from './routes/chatbot';
import { schedulerRoutes } from './routes/scheduler';
import { contentRoutes } from './routes/content';
import { notificationRoutes } from './routes/notifications';
import { errorHandler } from './middleware/errorHandler';
import { SchedulerService } from './services/SchedulerService';
import { NotificationService } from './services/NotificationService';
import { apiLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use(errorHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    // Initialize services
    await DatabaseService.initialize();
    await RedisService.initialize();
    await NotificationService.initialize();
    
    // Start scheduler
    SchedulerService.start();
    
    app.listen(PORT, () => {
      console.log(`🚀 Social Growth Suite running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();