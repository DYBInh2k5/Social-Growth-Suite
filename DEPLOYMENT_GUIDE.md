# Social Growth Suite - Deployment Guide

## 🚀 Production Deployment Guide

Hướng dẫn chi tiết để deploy Social Growth Suite lên production environment.

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Docker
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 20GB SSD
- **CPU**: 2+ cores recommended

### Required Services
- **Node.js**: 18.x hoặc cao hơn
- **PostgreSQL**: 12+ 
- **Redis**: 6+
- **Nginx**: Latest (for reverse proxy)
- **SSL Certificate**: Let's Encrypt hoặc commercial

## 🐳 Docker Deployment (Recommended)

### 1. Clone Repository
```bash
git clone <repository-url>
cd social-growth-suite
```

### 2. Environment Configuration
```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
```env
# Database
DATABASE_URL=postgresql://postgres:your_password@postgres:5432/social_growth_suite
DB_HOST=postgres
DB_PORT=5432
DB_NAME=social_growth_suite
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# Social Media APIs
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### 3. SSL Configuration
```bash
# Create SSL directory
mkdir -p ssl

# Copy your SSL certificates
cp your-domain.crt ssl/
cp your-domain.key ssl/
```

### 4. Nginx Configuration
```bash
# Create nginx.conf
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/your-domain.crt;
        ssl_certificate_key /etc/nginx/ssl/your-domain.key;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        client_max_body_size 10M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /health {
            proxy_pass http://app/health;
            access_log off;
        }
    }
}
EOF
```

### 5. Deploy with Docker Compose
```bash
# Build and start services
docker-compose up -d --build

# Check logs
docker-compose logs -f app

# Check status
docker-compose ps
```

### 6. Database Setup
```bash
# Run database migrations (if needed)
docker-compose exec app npm run migrate

# Or manually run SQL
docker-compose exec postgres psql -U postgres -d social_growth_suite -f /app/src/config/database.sql
```

## 🖥️ Manual Deployment

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Database Setup
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE social_growth_suite;
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE social_growth_suite TO app_user;
\q

# Run schema
psql -U app_user -d social_growth_suite -f src/config/database.sql
```

### 3. Application Setup
```bash
# Clone repository
git clone <repository-url>
cd social-growth-suite

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 4. PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'social-growth-suite',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
```

### 5. Nginx Configuration
```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/social-growth-suite

# Add configuration
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/social-growth-suite /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 Configuration

### Environment Variables
```bash
# Production optimizations
NODE_ENV=production
PORT=3000

# Database connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Redis configuration
REDIS_POOL_SIZE=10
REDIS_RETRY_ATTEMPTS=3

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/social-growth-suite/app.log

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret
CORS_ORIGIN=https://your-domain.com
```

### Database Optimization
```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Configuration
```bash
# Edit redis.conf
sudo nano /etc/redis/redis.conf

# Key settings
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis
```

## 📊 Monitoring & Logging

### 1. Application Monitoring
```bash
# Install monitoring tools
npm install -g @pm2/io

# PM2 monitoring
pm2 install pm2-server-monit
pm2 monitor
```

### 2. Log Management
```bash
# Create log directory
sudo mkdir -p /var/log/social-growth-suite
sudo chown $USER:$USER /var/log/social-growth-suite

# Logrotate configuration
sudo nano /etc/logrotate.d/social-growth-suite

/var/log/social-growth-suite/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Health Checks
```bash
# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="https://your-domain.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "$(date): Health check passed"
else
    echo "$(date): Health check failed - HTTP $RESPONSE"
    # Restart application
    pm2 restart social-growth-suite
fi
EOF

chmod +x health-check.sh

# Add to crontab
crontab -e
# Add: */5 * * * * /path/to/health-check.sh >> /var/log/health-check.log 2>&1
```

## 🔒 Security Hardening

### 1. Firewall Configuration
```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Fail2Ban
```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Configure for Nginx
sudo nano /etc/fail2ban/jail.local

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600

sudo systemctl restart fail2ban
```

### 3. Database Security
```bash
# PostgreSQL security
sudo nano /etc/postgresql/12/main/postgresql.conf

# Listen only on localhost
listen_addresses = 'localhost'

# Connection limits
max_connections = 100

sudo systemctl restart postgresql
```

## 🚀 Performance Optimization

### 1. Node.js Optimization
```javascript
// Add to package.json scripts
{
  "scripts": {
    "start:prod": "node --max-old-space-size=1024 --optimize-for-size dist/index.js"
  }
}
```

### 2. Database Indexing
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_scheduled_posts_user_status 
ON scheduled_posts(user_id, status) WHERE status = 'pending';

CREATE INDEX CONCURRENTLY idx_analytics_data_account_date_type 
ON analytics_data(account_id, date, metric_type);

CREATE INDEX CONCURRENTLY idx_chatbot_conversations_account_sentiment 
ON chatbot_conversations(account_id, sentiment) WHERE sentiment IS NOT NULL;
```

### 3. Caching Strategy
```javascript
// Redis caching configuration
const cacheConfig = {
  // User sessions: 24 hours
  userSession: 86400,
  
  // Analytics data: 1 hour
  analytics: 3600,
  
  // Content suggestions: 30 minutes
  contentSuggestions: 1800,
  
  // Trending topics: 15 minutes
  trendingTopics: 900
};
```

## 🔄 Backup & Recovery

### 1. Database Backup
```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/social-growth-suite"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="social_growth_suite"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U postgres $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x backup-db.sh

# Schedule daily backup
crontab -e
# Add: 0 2 * * * /path/to/backup-db.sh
```

### 2. Application Backup
```bash
# Backup application files
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=.git \
  /path/to/social-growth-suite
```

### 3. Recovery Procedure
```bash
# Database recovery
gunzip -c db_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U postgres social_growth_suite

# Application recovery
tar -xzf app_backup_YYYYMMDD.tar.gz
cd social-growth-suite
npm ci --only=production
npm run build
pm2 restart social-growth-suite
```

## 📈 Scaling

### 1. Horizontal Scaling
```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  app:
    deploy:
      replicas: 3
    
  nginx:
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
```

### 2. Load Balancer Configuration
```nginx
upstream app_servers {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    location / {
        proxy_pass http://app_servers;
    }
}
```

### 3. Database Scaling
```bash
# Read replicas setup
# Master-slave configuration
# Connection pooling with PgBouncer
```

## 🚨 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart if needed
   pm2 restart social-growth-suite
   ```

2. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connections
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
   ```

3. **Redis Connection Issues**
   ```bash
   # Check Redis status
   sudo systemctl status redis
   
   # Test connection
   redis-cli ping
   ```

4. **SSL Certificate Issues**
   ```bash
   # Check certificate expiry
   sudo certbot certificates
   
   # Renew if needed
   sudo certbot renew
   ```

### Log Analysis
```bash
# Application logs
pm2 logs social-growth-suite

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u social-growth-suite -f
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- [ ] Weekly database backup verification
- [ ] Monthly security updates
- [ ] Quarterly performance review
- [ ] SSL certificate renewal (automated)
- [ ] Log rotation and cleanup
- [ ] Dependency updates

### Monitoring Checklist
- [ ] Application uptime
- [ ] Database performance
- [ ] Redis memory usage
- [ ] Disk space
- [ ] SSL certificate expiry
- [ ] API response times
- [ ] Error rates

Để được hỗ trợ deployment, vui lòng liên hệ team DevOps với thông tin chi tiết về environment và error logs.