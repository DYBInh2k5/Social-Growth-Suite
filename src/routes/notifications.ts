import { Router } from 'express';
import { NotificationService } from '../services/NotificationService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get notifications
router.get('/', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await NotificationService.getNotifications(userId, page, limit, unreadOnly);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const count = await NotificationService.getUnreadCount(userId);

    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
});

// Mark notifications as read
router.put('/mark-read', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds must be an array' });
    }

    await NotificationService.markAsRead(userId, notificationIds);

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    await NotificationService.markAllAsRead(userId);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Get notification rules/preferences
router.get('/rules', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const rules = await NotificationService.getNotificationRules(userId);

    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

// Update notification rules/preferences
router.put('/rules', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules must be an array' });
    }

    await NotificationService.updateNotificationRules(userId, rules);

    res.json({ message: 'Notification rules updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get real-time notifications (for WebSocket or polling)
router.get('/realtime', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await NotificationService.getRealTimeNotifications(userId);

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

// Test notification (for development)
router.post('/test', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { type, title, message, data } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    await NotificationService.createNotification({
      userId,
      type,
      title,
      message,
      data,
      isRead: false
    });

    res.json({ message: 'Test notification created' });
  } catch (error) {
    next(error);
  }
});

export { router as notificationRoutes };