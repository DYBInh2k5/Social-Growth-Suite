import { Router } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get scheduled posts
router.get('/', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let params = [userId, limit, offset];

    if (status !== 'all') {
      statusFilter = 'AND sp.status = $4';
      params.push(status);
    }

    const query = `
      SELECT 
        sp.id,
        sp.content,
        sp.media_urls,
        sp.scheduled_time,
        sp.status,
        sp.posted_at,
        sp.created_at,
        sa.platform,
        sa.account_name
      FROM scheduled_posts sp
      JOIN social_accounts sa ON sp.account_id = sa.id
      WHERE sa.user_id = $1 ${statusFilter}
      ORDER BY sp.scheduled_time DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await DatabaseService.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*)
      FROM scheduled_posts sp
      JOIN social_accounts sa ON sp.account_id = sa.id
      WHERE sa.user_id = $1 ${statusFilter}
    `;
    
    const countParams = status !== 'all' ? [userId, status] : [userId];
    const countResult = await DatabaseService.query(countQuery, countParams);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      posts: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create scheduled post
router.post('/', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { accountId, content, mediaUrls, scheduledTime } = req.body;

    if (!accountId || !content || !scheduledTime) {
      return res.status(400).json({ error: 'Account ID, content, and scheduled time are required' });
    }

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2 AND is_active = true',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const result = await DatabaseService.query(
      `INSERT INTO scheduled_posts (user_id, account_id, content, media_urls, scheduled_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, scheduled_time, status, created_at`,
      [userId, accountId, content, mediaUrls || [], scheduledTime]
    );

    res.status(201).json({
      message: 'Post scheduled successfully',
      post: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Update scheduled post
router.put('/:postId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { content, mediaUrls, scheduledTime } = req.body;

    // Verify post belongs to user and is still pending
    const checkResult = await DatabaseService.query(
      `SELECT sp.id FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sp.id = $1 AND sa.user_id = $2 AND sp.status = 'pending'`,
      [postId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or cannot be modified' });
    }

    // Validate scheduled time if provided
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }
    }

    const result = await DatabaseService.query(
      `UPDATE scheduled_posts 
       SET content = COALESCE($1, content),
           media_urls = COALESCE($2, media_urls),
           scheduled_time = COALESCE($3, scheduled_time),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, content, media_urls, scheduled_time, status`,
      [content, mediaUrls, scheduledTime, postId]
    );

    res.json({
      message: 'Scheduled post updated successfully',
      post: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Delete scheduled post
router.delete('/:postId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    // Verify post belongs to user and is still pending
    const result = await DatabaseService.query(
      `DELETE FROM scheduled_posts sp
       USING social_accounts sa
       WHERE sp.account_id = sa.id 
         AND sp.id = $1 
         AND sa.user_id = $2 
         AND sp.status = 'pending'
       RETURNING sp.id`,
      [postId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or cannot be deleted' });
    }

    res.json({
      message: 'Scheduled post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get post by ID
router.get('/:postId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const result = await DatabaseService.query(
      `SELECT 
         sp.id,
         sp.content,
         sp.media_urls,
         sp.scheduled_time,
         sp.status,
         sp.posted_at,
         sp.created_at,
         sa.id as account_id,
         sa.platform,
         sa.account_name
       FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sp.id = $1 AND sa.user_id = $2`,
      [postId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      post: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Bulk schedule posts
router.post('/bulk', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { posts } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'Posts array is required' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      try {
        // Verify account belongs to user
        const checkResult = await DatabaseService.query(
          'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2 AND is_active = true',
          [post.accountId, userId]
        );

        if (checkResult.rows.length === 0) {
          errors.push({ index: i, error: 'Account not found or inactive' });
          continue;
        }

        // Validate scheduled time
        const scheduledDate = new Date(post.scheduledTime);
        if (scheduledDate <= new Date()) {
          errors.push({ index: i, error: 'Scheduled time must be in the future' });
          continue;
        }

        const result = await DatabaseService.query(
          `INSERT INTO scheduled_posts (user_id, account_id, content, media_urls, scheduled_time)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, content, scheduled_time, status`,
          [userId, post.accountId, post.content, post.mediaUrls || [], post.scheduledTime]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ index: i, error: (error as Error).message });
      }
    }

    res.json({
      message: `Bulk scheduling completed. ${results.length} posts scheduled, ${errors.length} errors.`,
      scheduled: results,
      errors
    });
  } catch (error) {
    next(error);
  }
});

// Get scheduling statistics
router.get('/stats/overview', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;

    // Get post counts by status
    const statusResult = await DatabaseService.query(
      `SELECT 
         sp.status,
         COUNT(*) as count
       FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sa.user_id = $1 AND sp.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY sp.status`,
      [userId]
    );

    // Get posts by platform
    const platformResult = await DatabaseService.query(
      `SELECT 
         sa.platform,
         COUNT(*) as count,
         COUNT(CASE WHEN sp.status = 'published' THEN 1 END) as published_count
       FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sa.user_id = $1 AND sp.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY sa.platform`,
      [userId]
    );

    // Get daily posting activity
    const dailyResult = await DatabaseService.query(
      `SELECT 
         DATE(sp.scheduled_time) as date,
         COUNT(*) as scheduled_count,
         COUNT(CASE WHEN sp.status = 'published' THEN 1 END) as published_count
       FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sa.user_id = $1 AND sp.scheduled_time >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(sp.scheduled_time)
       ORDER BY date`,
      [userId]
    );

    // Get upcoming posts (next 7 days)
    const upcomingResult = await DatabaseService.query(
      `SELECT COUNT(*) as count
       FROM scheduled_posts sp
       JOIN social_accounts sa ON sp.account_id = sa.id
       WHERE sa.user_id = $1 
         AND sp.status = 'pending' 
         AND sp.scheduled_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
      [userId]
    );

    res.json({
      statusBreakdown: statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      platformBreakdown: platformResult.rows,
      dailyActivity: dailyResult.rows.map(row => ({
        date: row.date,
        scheduled: parseInt(row.scheduled_count),
        published: parseInt(row.published_count)
      })),
      upcomingPosts: parseInt(upcomingResult.rows[0].count),
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

export { router as schedulerRoutes };