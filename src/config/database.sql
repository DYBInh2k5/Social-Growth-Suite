-- Social Growth Suite Database Schema
-- This file contains the complete database schema for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255), -- Platform-specific account ID
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    account_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform, account_id)
);

-- Scheduled posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    scheduled_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
    platform_post_id VARCHAR(255), -- ID from the social platform after posting
    error_message TEXT,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics data table
CREATE TABLE IF NOT EXISTS analytics_data (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value INTEGER NOT NULL,
    metric_data JSONB DEFAULT '{}', -- Additional metric details
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, metric_type, date)
);

-- Chatbot conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
    user_handle VARCHAR(255) NOT NULL,
    platform_user_id VARCHAR(255),
    message TEXT NOT NULL,
    response TEXT,
    sentiment FLOAT CHECK (sentiment >= -1 AND sentiment <= 1),
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    auto_replied BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification rules table
CREATE TABLE IF NOT EXISTS notification_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
);

-- Content templates table
CREATE TABLE IF NOT EXISTS content_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    platform VARCHAR(50),
    usage_count INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table for tracking important actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform ON social_accounts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time ON scheduled_posts(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_analytics_data_account_date ON analytics_data(account_id, date);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_account_created ON chatbot_conversations(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW user_account_summary AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    COUNT(sa.id) as total_accounts,
    COUNT(CASE WHEN sa.is_active THEN 1 END) as active_accounts,
    COUNT(CASE WHEN sp.status = 'pending' THEN 1 END) as pending_posts,
    MAX(sa.last_sync_at) as last_sync
FROM users u
LEFT JOIN social_accounts sa ON u.id = sa.user_id
LEFT JOIN scheduled_posts sp ON sa.id = sp.account_id
GROUP BY u.id, u.name, u.email;

CREATE OR REPLACE VIEW account_analytics_summary AS
SELECT 
    sa.id as account_id,
    sa.platform,
    sa.account_name,
    sa.user_id,
    COALESCE(MAX(CASE WHEN ad.metric_type = 'followers' THEN ad.metric_value END), 0) as followers,
    COALESCE(MAX(CASE WHEN ad.metric_type = 'posts' THEN ad.metric_value END), 0) as posts,
    COALESCE(MAX(CASE WHEN ad.metric_type = 'likes' THEN ad.metric_value END), 0) as likes,
    COALESCE(AVG(cc.sentiment), 0) as avg_sentiment,
    COUNT(cc.id) as total_conversations
FROM social_accounts sa
LEFT JOIN analytics_data ad ON sa.id = ad.account_id 
    AND ad.date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN chatbot_conversations cc ON sa.id = cc.account_id 
    AND cc.created_at >= NOW() - INTERVAL '30 days'
WHERE sa.is_active = true
GROUP BY sa.id, sa.platform, sa.account_name, sa.user_id;

-- Sample data for development (optional)
-- INSERT INTO users (email, password_hash, name) VALUES 
-- ('demo@example.com', '$2a$12$example_hash', 'Demo User');

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts and authentication data';
COMMENT ON TABLE social_accounts IS 'Connected social media accounts';
COMMENT ON TABLE scheduled_posts IS 'Posts scheduled for future publishing';
COMMENT ON TABLE analytics_data IS 'Social media metrics and analytics';
COMMENT ON TABLE chatbot_conversations IS 'AI chatbot conversation history';
COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON TABLE content_templates IS 'Reusable content templates';
COMMENT ON TABLE audit_logs IS 'System audit trail for security and compliance';