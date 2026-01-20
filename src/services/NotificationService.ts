import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';

interface Notification {
  id?: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

type NotificationType = 
  | 'post_published' 
  | 'post_failed' 
  | 'high_engagement' 
  | 'low_engagement'
  | 'account_disconnected'
  | 'growth_milestone'
  | 'negative_sentiment'
  | 'system_alert';

interface NotificationRule {
  userId: number;
  type: NotificationType;
  enabled: boolean;
  conditions?: Record<string, any>;
}

export class NotificationService {
  
  static async initialize(): Promise<void> {
    // Create notifications table
    await DatabaseService.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notification rules table
    await DatabaseService.query(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        conditions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, type)
      )
    `);

    console.log('✅ Notification service initialized');
  }

  static async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<void> {
    try {
      // Check if user has this notification type enabled
      const ruleResult = await DatabaseService.query(
        'SELECT enabled FROM notification_rules WHERE user_id = $1 AND type = $2',
        [notification.userId, notification.type]
      );

      // If no rule exists, assume enabled (default behavior)
      const isEnabled = ruleResult.rows.length === 0 || ruleResult.rows[0].enabled;

      if (!isEnabled) {
        return; // Skip notification if disabled
      }

      // Store notification in database
      await DatabaseService.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          JSON.stringify(notification.data || {})
        ]
      );

      // Store in Redis for real-time notifications
      const redisKey = `notifications:${notification.userId}`;
      const notificationData = {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        timestamp: new Date().toISOString()
      };

      await RedisService.addToSet(redisKey, JSON.stringify(notificationData));

      // Keep only last 50 notifications in Redis
      const notifications = await RedisService.getSet(redisKey);
      if (notifications.length > 50) {
        const oldestNotifications = notifications.slice(0, notifications.length - 50);
        for (const oldNotification of oldestNotifications) {
          await RedisService.removeFromSet(redisKey, oldNotification);
        }
      }

      console.log(`📢 Notification created for user ${notification.userId}: ${notification.title}`);

    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  static async getNotifications(
    userId: number, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: Notification[], pagination: any }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE user_id = $1';
      let params = [userId];

      if (unreadOnly) {
        whereClause += ' AND is_read = false';
      }

      const result = await DatabaseService.query(
        `SELECT id, type, title, message, data, is_read, created_at
         FROM notifications 
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      // Get total count
      const countResult = await DatabaseService.query(
        `SELECT COUNT(*) FROM notifications ${whereClause}`,
        params
      );

      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);

      return {
        notifications: result.rows.map(row => ({
          id: row.id,
          userId,
          type: row.type,
          title: row.title,
          message: row.message,
          data: row.data,
          isRead: row.is_read,
          createdAt: row.created_at
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  static async markAsRead(userId: number, notificationIds: number[]): Promise<void> {
    try {
      await DatabaseService.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2)',
        [userId, notificationIds]
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  static async markAllAsRead(userId: number): Promise<void> {
    try {
      await DatabaseService.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [userId]
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  static async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await DatabaseService.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  static async updateNotificationRules(userId: number, rules: Partial<NotificationRule>[]): Promise<void> {
    try {
      for (const rule of rules) {
        await DatabaseService.query(
          `INSERT INTO notification_rules (user_id, type, enabled, conditions)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, type)
           DO UPDATE SET enabled = $3, conditions = $4, updated_at = CURRENT_TIMESTAMP`,
          [userId, rule.type, rule.enabled, JSON.stringify(rule.conditions || {})]
        );
      }
    } catch (error) {
      console.error('Error updating notification rules:', error);
      throw error;
    }
  }

  static async getNotificationRules(userId: number): Promise<NotificationRule[]> {
    try {
      const result = await DatabaseService.query(
        'SELECT type, enabled, conditions FROM notification_rules WHERE user_id = $1',
        [userId]
      );

      // Return default rules if none exist
      if (result.rows.length === 0) {
        return this.getDefaultNotificationRules(userId);
      }

      return result.rows.map(row => ({
        userId,
        type: row.type,
        enabled: row.enabled,
        conditions: row.conditions
      }));

    } catch (error) {
      console.error('Error getting notification rules:', error);
      return this.getDefaultNotificationRules(userId);
    }
  }

  private static getDefaultNotificationRules(userId: number): NotificationRule[] {
    return [
      { userId, type: 'post_published', enabled: true },
      { userId, type: 'post_failed', enabled: true },
      { userId, type: 'high_engagement', enabled: true, conditions: { threshold: 50 } },
      { userId, type: 'low_engagement', enabled: false, conditions: { threshold: 5 } },
      { userId, type: 'account_disconnected', enabled: true },
      { userId, type: 'growth_milestone', enabled: true, conditions: { milestones: [100, 500, 1000, 5000] } },
      { userId, type: 'negative_sentiment', enabled: true, conditions: { threshold: -0.5 } },
      { userId, type: 'system_alert', enabled: true }
    ];
  }

  // Notification triggers for various events
  static async notifyPostPublished(userId: number, accountName: string, content: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'post_published',
      title: 'Bài viết đã được đăng',
      message: `Bài viết của bạn đã được đăng thành công trên ${accountName}`,
      data: { accountName, content: content.substring(0, 100) },
      isRead: false
    });
  }

  static async notifyPostFailed(userId: number, accountName: string, error: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'post_failed',
      title: 'Đăng bài thất bại',
      message: `Không thể đăng bài trên ${accountName}: ${error}`,
      data: { accountName, error },
      isRead: false
    });
  }

  static async notifyHighEngagement(userId: number, accountName: string, interactions: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'high_engagement',
      title: 'Tương tác cao!',
      message: `Bài viết của bạn trên ${accountName} đang có ${interactions} tương tác`,
      data: { accountName, interactions },
      isRead: false
    });
  }

  static async notifyGrowthMilestone(userId: number, accountName: string, milestone: number, metric: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'growth_milestone',
      title: 'Chúc mừng! Đạt mốc quan trọng',
      message: `${accountName} đã đạt ${milestone} ${metric}!`,
      data: { accountName, milestone, metric },
      isRead: false
    });
  }

  static async notifyAccountDisconnected(userId: number, accountName: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'account_disconnected',
      title: 'Tài khoản bị ngắt kết nối',
      message: `Tài khoản ${accountName} cần được kết nối lại`,
      data: { accountName },
      isRead: false
    });
  }

  static async notifyNegativeSentiment(userId: number, accountName: string, sentiment: number): Promise<void> {
    await this.createNotification({
      userId,
      type: 'negative_sentiment',
      title: 'Cảnh báo: Phản hồi tiêu cực',
      message: `Tài khoản ${accountName} đang nhận nhiều phản hồi tiêu cực`,
      data: { accountName, sentiment },
      isRead: false
    });
  }

  static async notifySystemAlert(userId: number, title: string, message: string, data?: any): Promise<void> {
    await this.createNotification({
      userId,
      type: 'system_alert',
      title,
      message,
      data,
      isRead: false
    });
  }

  // Clean up old notifications
  static async cleanupOldNotifications(daysToKeep: number = 30): Promise<void> {
    try {
      await DatabaseService.query(
        'DELETE FROM notifications WHERE created_at < NOW() - INTERVAL \'${daysToKeep} days\'',
        []
      );
      console.log(`✅ Cleaned up notifications older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  // Get real-time notifications from Redis
  static async getRealTimeNotifications(userId: number): Promise<any[]> {
    try {
      const redisKey = `notifications:${userId}`;
      const notifications = await RedisService.getSet(redisKey);
      
      return notifications.map(notificationStr => {
        try {
          return JSON.parse(notificationStr);
        } catch {
          return null;
        }
      }).filter(Boolean);

    } catch (error) {
      console.error('Error getting real-time notifications:', error);
      return [];
    }
  }
}