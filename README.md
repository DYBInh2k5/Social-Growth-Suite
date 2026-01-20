# Social Growth Suite

[![CI/CD Pipeline](https://github.com/DYBInh2k5/Social-Growth-Suite/actions/workflows/ci.yml/badge.svg)](https://github.com/DYBInh2k5/Social-Growth-Suite/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

Comprehensive automation suite for social media management with multi-account support, smart chatbot, analytics dashboard, and intelligent scheduling system.

## 🎯 Features

- **🔄 Multi-account Management**: Connect and manage multiple social media accounts across platforms
- **💬 Smart Auto-reply Chatbot**: AI-powered chatbot with sentiment analysis and context awareness
- **📈 Growth Analytics Dashboard**: Comprehensive analytics with growth tracking and audience insights
- **🎯 Target Audience Analysis**: Deep insights into audience behavior and engagement patterns
- **⏰ Smart Scheduling System**: Intelligent post scheduling with bulk operations

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Automation**: Puppeteer for web automation
- **Cache**: Redis for session management and rate limiting
- **Database**: PostgreSQL for data persistence
- **AI**: OpenAI GPT for chatbot responses and sentiment analysis
- **Authentication**: JWT-based authentication

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- OpenAI API key (for chatbot features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DYBInh2k5/Social-Growth-Suite.git
   cd Social-Growth-Suite
   ```

2. **Quick Setup (Recommended)**
   ```bash
   # Linux/macOS
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   
   # Windows
   scripts/setup.bat
   ```

3. **Manual Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Copy environment file
   cp .env.example .env
   # Edit .env with your configuration
   
   # Build the project
   npm run build
   ```

4. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb social_growth_suite
   
   # Tables will be created automatically on first run
   ```

5. **Start Services**
   
   **Option A: Docker (Recommended)**
   ```bash
   # Development with hot reload
   docker-compose -f docker-compose.dev.yml up -d
   
   # Production
   docker-compose up -d
   ```
   
   **Option B: Manual**
   ```bash
   # Start Redis
   redis-server
   
   # Start the application
   npm run dev
   ```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Social Accounts
- `GET /api/accounts` - List user's social accounts
- `POST /api/accounts` - Add new social account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Remove account
- `GET /api/accounts/:id/analytics` - Account analytics
- `POST /api/accounts/:id/test` - Test account connection

### Analytics
- `GET /api/analytics/dashboard` - Dashboard overview
- `GET /api/analytics/growth` - Growth analytics
- `GET /api/analytics/audience` - Audience analysis
- `GET /api/analytics/compare` - Platform comparison

### Chatbot
- `POST /api/chatbot/message` - Process incoming message (webhook)
- `GET /api/chatbot/conversations/:accountId` - Conversation history
- `GET /api/chatbot/stats/:accountId` - Chatbot statistics
- `GET /api/chatbot/settings/:accountId` - Get chatbot settings
- `PUT /api/chatbot/settings/:accountId` - Update chatbot settings

### Scheduler
- `GET /api/scheduler` - List scheduled posts
- `POST /api/scheduler` - Create scheduled post
- `PUT /api/scheduler/:id` - Update scheduled post
- `DELETE /api/scheduler/:id` - Delete scheduled post
- `POST /api/scheduler/bulk` - Bulk schedule posts
- `GET /api/scheduler/stats/overview` - Scheduling statistics

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/social_growth_suite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_growth_suite
DB_USER=username
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Social Media APIs
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
INSTAGRAM_ACCESS_TOKEN=your_instagram_token

# OpenAI for chatbot
OPENAI_API_KEY=your_openai_api_key
```

### Social Media Platform Setup

#### Twitter/X
1. Create a Twitter Developer account
2. Create a new app and get API keys
3. Set up OAuth 2.0 for user authentication

#### Facebook/Meta
1. Create a Facebook Developer account
2. Create a new app
3. Add Facebook Login and Pages API permissions

#### Instagram
1. Use Facebook Developer account
2. Set up Instagram Basic Display API
3. Get long-lived access tokens

#### LinkedIn
1. Create a LinkedIn Developer account
2. Create a new app
3. Request Marketing Developer Platform access

## 🤖 Chatbot Features

- **Sentiment Analysis**: Automatically analyzes message sentiment
- **Context Awareness**: Maintains conversation history for better responses
- **Rate Limiting**: Prevents spam with intelligent rate limiting
- **Custom Prompts**: Configurable response templates per account
- **Multi-platform**: Works across Twitter, Facebook, Instagram, LinkedIn

## 📈 Analytics Features

- **Growth Tracking**: Monitor follower growth, engagement rates
- **Audience Insights**: Understand when your audience is most active
- **Platform Comparison**: Compare performance across different platforms
- **Conversation Analytics**: Track chatbot performance and sentiment trends
- **Scheduling Analytics**: Monitor posting patterns and success rates

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- Helmet.js security headers

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Manual Deployment

1. Build the application: `npm run build`
2. Set up production environment variables
3. Configure reverse proxy (nginx recommended)
4. Set up SSL certificates
5. Configure monitoring and logging

## 📝 Development

### Project Structure

```
src/
├── index.ts              # Application entry point
├── middleware/           # Express middleware
│   ├── auth.ts          # Authentication middleware
│   └── errorHandler.ts  # Error handling
├── routes/              # API routes
│   ├── auth.ts         # Authentication routes
│   ├── accounts.ts     # Social accounts management
│   ├── analytics.ts    # Analytics endpoints
│   ├── chatbot.ts      # Chatbot functionality
│   └── scheduler.ts    # Post scheduling
└── services/           # Business logic
    ├── DatabaseService.ts    # Database operations
    ├── RedisService.ts      # Redis operations
    ├── SchedulerService.ts  # Cron jobs and scheduling
    ├── SocialMediaService.ts # Social media integrations
    └── ChatbotService.ts    # AI chatbot logic
```

### Adding New Platforms

1. Extend `SocialMediaService` with platform-specific methods
2. Add platform authentication flow
3. Update database schema if needed
4. Add platform-specific analytics collection
5. Test integration thoroughly

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

For support and questions:
- � [Createp an issue](https://github.com/DYBInh2k5/Social-Growth-Suite/issues)
- 📖 Check the [API Documentation](API_DOCUMENTATION.md)
- 🚀 Review the [Deployment Guide](DEPLOYMENT_GUIDE.md)
- 💬 Join our [Discussions](https://github.com/DYBInh2k5/Social-Growth-Suite/discussions)

## 🔮 Roadmap

- [ ] Advanced AI features (content generation, optimal posting times)
- [ ] More social media platforms (TikTok, Pinterest, YouTube)
- [ ] Team collaboration features
- [ ] Advanced analytics and reporting
- [ ] Mobile app
- [ ] Webhook integrations
- [ ] A/B testing for posts
- [ ] Competitor analysis

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=DYBInh2k5/Social-Growth-Suite&type=Date)](https://star-history.com/#DYBInh2k5/Social-Growth-Suite&Date)

---

<div align="center">
  <strong>Built with ❤️ for the social media automation community</strong>
  <br>
  <sub>If this project helped you, please consider giving it a ⭐</sub>
</div>