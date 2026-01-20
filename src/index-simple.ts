import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Social Growth Suite API is running!'
  });
});

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Social Growth Suite API is working!',
    features: [
      '🔄 Multi-account management',
      '💬 Smart auto-reply chatbot', 
      '📈 Growth analytics dashboard',
      '🎯 Target audience analysis',
      '⏰ Smart scheduling system'
    ],
    endpoints: {
      auth: '/api/auth/*',
      accounts: '/api/accounts/*',
      analytics: '/api/analytics/*',
      chatbot: '/api/chatbot/*',
      scheduler: '/api/scheduler/*',
      content: '/api/content/*',
      notifications: '/api/notifications/*'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Please check the API documentation for available endpoints',
    availableEndpoints: [
      'GET /health',
      'GET /api/test'
    ]
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Social Growth Suite API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📚 Ready for database and Redis connection!`);
});

export default app;