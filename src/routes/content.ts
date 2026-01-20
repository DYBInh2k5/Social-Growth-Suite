import { Router } from 'express';
import { ContentService } from '../services/ContentService';
import { AnalyticsService } from '../services/AnalyticsService';
import { DatabaseService } from '../services/DatabaseService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Generate content suggestions
router.post('/suggestions', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { platform, category, count = 5 } = req.body;

    if (!platform) {
      return res.status(400).json({ error: 'Platform is required' });
    }

    const suggestions = await ContentService.generateContentSuggestions(
      userId,
      platform,
      category,
      parseInt(count)
    );

    res.json({
      suggestions,
      platform,
      category: category || 'general',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get trending topics
router.get('/trending/:platform', authenticateToken, async (req: any, res, next) => {
  try {
    const platform = req.params.platform;
    const trends = await ContentService.getTrendingTopics(platform);

    res.json({
      platform,
      trends,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Analyze content performance
router.get('/performance/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const days = parseInt(req.query.days as string) || 30;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id, platform, account_name FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = checkResult.rows[0];
    const performance = await ContentService.analyzeContentPerformance(parseInt(accountId), days);

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        name: account.account_name
      },
      performance,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Generate hashtag suggestions
router.post('/hashtags', authenticateToken, async (req: any, res, next) => {
  try {
    const { content, platform } = req.body;

    if (!content || !platform) {
      return res.status(400).json({ error: 'Content and platform are required' });
    }

    const hashtags = await ContentService.generateHashtagSuggestions(content, platform);

    res.json({
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      platform,
      hashtags
    });
  } catch (error) {
    next(error);
  }
});

// Get content calendar
router.get('/calendar', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const platform = req.query.platform as string;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    let platformFilter = '';
    let params = [userId, startDate, endDate];

    if (platform) {
      platformFilter = 'AND sa.platform = $4';
      params.push(platform);
    }

    const query = `
      SELECT 
        sp.id,
        sp.content,
        sp.scheduled_time,
        sp.status,
        sp.media_urls,
        sa.platform,
        sa.account_name,
        DATE(sp.scheduled_time) as schedule_date
      FROM scheduled_posts sp
      JOIN social_accounts sa ON sp.account_id = sa.id
      WHERE sa.user_id = $1 
        AND DATE(sp.scheduled_time) BETWEEN $2 AND $3
        ${platformFilter}
      ORDER BY sp.scheduled_time ASC
    `;

    const result = await DatabaseService.query(query, params);

    // Group by date
    const calendar = result.rows.reduce((acc, post) => {
      const date = post.schedule_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push({
        id: post.id,
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        scheduledTime: post.scheduled_time,
        status: post.status,
        hasMedia: post.media_urls && post.media_urls.length > 0,
        platform: post.platform,
        accountName: post.account_name
      });
      
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      calendar,
      period: {
        startDate,
        endDate
      },
      platform: platform || 'all',
      totalPosts: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Get content insights
router.get('/insights', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;

    const insights = await AnalyticsService.generateInsightReport(userId, days);

    // Add content-specific insights
    const accountsResult = await DatabaseService.query(
      'SELECT id, platform, account_name FROM social_accounts WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    const contentInsights = [];

    for (const account of accountsResult.rows) {
      const performance = await ContentService.analyzeContentPerformance(account.id, days);
      
      contentInsights.push({
        account: {
          id: account.id,
          platform: account.platform,
          name: account.account_name
        },
        bestPostingHours: performance.hourlyPerformance.slice(0, 3).map(h => `${h.hour}:00`),
        bestPostingDays: performance.weeklyPerformance.slice(0, 2).map(d => d.day),
        avgInteractions: Math.round(performance.avgInteractions || 0),
        avgSentiment: Math.round((performance.avgSentiment || 0) * 100) / 100,
        topPerformingContent: performance.topPosts.slice(0, 3)
      });
    }

    res.json({
      ...insights,
      contentInsights,
      recommendations: [
        ...insights.summary.recommendations,
        ...generateContentRecommendations(contentInsights)
      ]
    });
  } catch (error) {
    next(error);
  }
});

// Generate content recommendations based on performance
function generateContentRecommendations(contentInsights: any[]): string[] {
  const recommendations = [];

  contentInsights.forEach(insight => {
    // Best posting time recommendation
    if (insight.bestPostingHours.length > 0) {
      recommendations.push(
        `Tài khoản ${insight.account.name}: Đăng bài vào ${insight.bestPostingHours[0]} để có tương tác tốt nhất`
      );
    }

    // Sentiment recommendation
    if (insight.avgSentiment < 0.2) {
      recommendations.push(
        `Tài khoản ${insight.account.name}: Cần cải thiện nội dung để tăng phản hồi tích cực`
      );
    }

    // Interaction recommendation
    if (insight.avgInteractions < 5) {
      recommendations.push(
        `Tài khoản ${insight.account.name}: Tăng tương tác bằng cách đặt câu hỏi và sử dụng call-to-action`
      );
    }
  });

  return recommendations.slice(0, 5);
}

// Save content template
router.post('/templates', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { name, content, hashtags, category, platform } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    // Create templates table if not exists
    await DatabaseService.query(`
      CREATE TABLE IF NOT EXISTS content_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        hashtags TEXT[],
        category VARCHAR(100),
        platform VARCHAR(50),
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await DatabaseService.query(
      `INSERT INTO content_templates (user_id, name, content, hashtags, category, platform)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, created_at`,
      [userId, name, content, hashtags || [], category, platform]
    );

    res.status(201).json({
      message: 'Content template saved successfully',
      template: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Get content templates
router.get('/templates', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const category = req.query.category as string;
    const platform = req.query.platform as string;

    let filters = '';
    let params = [userId];

    if (category) {
      filters += ' AND category = $2';
      params.push(category);
    }

    if (platform) {
      const paramIndex = params.length + 1;
      filters += ` AND platform = $${paramIndex}`;
      params.push(platform);
    }

    const result = await DatabaseService.query(
      `SELECT id, name, content, hashtags, category, platform, usage_count, created_at
       FROM content_templates 
       WHERE user_id = $1 ${filters}
       ORDER BY usage_count DESC, created_at DESC`,
      params
    );

    res.json({
      templates: result.rows,
      filters: {
        category: category || 'all',
        platform: platform || 'all'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Use content template
router.post('/templates/:templateId/use', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const templateId = req.params.templateId;

    // Verify template belongs to user and get template data
    const result = await DatabaseService.query(
      'SELECT * FROM content_templates WHERE id = $1 AND user_id = $2',
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];

    // Increment usage count
    await DatabaseService.query(
      'UPDATE content_templates SET usage_count = usage_count + 1 WHERE id = $1',
      [templateId]
    );

    res.json({
      template: {
        id: template.id,
        name: template.name,
        content: template.content,
        hashtags: template.hashtags,
        category: template.category,
        platform: template.platform
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as contentRoutes };