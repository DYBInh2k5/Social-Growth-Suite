import { Router } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;

    // Get all user accounts
    const accountsResult = await DatabaseService.query(
      'SELECT id, platform, account_name FROM social_accounts WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    const accounts = accountsResult.rows;
    const accountIds = accounts.map((acc: any) => acc.id);

    if (accountIds.length === 0) {
      return res.json({
        summary: { totalFollowers: 0, totalPosts: 0, totalEngagement: 0 },
        accounts: [],
        trends: []
      });
    }

    // Get latest metrics for each account
    const metricsResult = await DatabaseService.query(
      `SELECT DISTINCT ON (account_id, metric_type) 
         account_id, metric_type, metric_value, date
       FROM analytics_data 
       WHERE account_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY account_id, metric_type, date DESC`,
      [accountIds]
    );

    // Calculate summary
    let totalFollowers = 0;
    let totalPosts = 0;
    let totalEngagement = 0;

    const accountMetrics = accounts.map(account => {
      const metrics = metricsResult.rows.filter(m => m.account_id === account.id);
      const followers = metrics.find(m => m.metric_type === 'followers')?.metric_value || 0;
      const posts = metrics.find(m => m.metric_type === 'posts')?.metric_value || 0;
      const likes = metrics.find(m => m.metric_type === 'likes')?.metric_value || 0;

      totalFollowers += followers;
      totalPosts += posts;
      totalEngagement += likes;

      return {
        ...account,
        followers,
        posts,
        engagement: likes
      };
    });

    // Get trends (growth over time)
    const trendsResult = await DatabaseService.query(
      `SELECT metric_type, date, SUM(metric_value) as total_value
       FROM analytics_data 
       WHERE account_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY metric_type, date
       ORDER BY date ASC`,
      [accountIds]
    );

    const trends = trendsResult.rows.reduce((acc, row) => {
      if (!acc[row.metric_type]) {
        acc[row.metric_type] = [];
      }
      acc[row.metric_type].push({
        date: row.date,
        value: parseInt(row.total_value)
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      summary: {
        totalFollowers,
        totalPosts,
        totalEngagement
      },
      accounts: accountMetrics,
      trends,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Get growth analytics
router.get('/growth', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;
    const accountId = req.query.accountId;

    let accountFilter = '';
    let params = [userId];

    if (accountId) {
      accountFilter = 'AND sa.id = $2';
      params.push(accountId);
    }

    const query = `
      SELECT 
        sa.id as account_id,
        sa.platform,
        sa.account_name,
        ad.metric_type,
        ad.metric_value,
        ad.date,
        LAG(ad.metric_value) OVER (PARTITION BY sa.id, ad.metric_type ORDER BY ad.date) as previous_value
      FROM social_accounts sa
      JOIN analytics_data ad ON sa.id = ad.account_id
      WHERE sa.user_id = $1 AND sa.is_active = true ${accountFilter}
        AND ad.date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY sa.id, ad.metric_type, ad.date
    `;

    const result = await DatabaseService.query(query, params);

    // Calculate growth rates
    const growthData = result.rows.map(row => ({
      ...row,
      growth_rate: row.previous_value ? 
        ((row.metric_value - row.previous_value) / row.previous_value * 100) : 0
    }));

    // Group by account and metric
    const groupedData = growthData.reduce((acc, row) => {
      const key = `${row.account_id}_${row.metric_type}`;
      if (!acc[key]) {
        acc[key] = {
          accountId: row.account_id,
          platform: row.platform,
          accountName: row.account_name,
          metricType: row.metric_type,
          data: []
        };
      }
      acc[key].data.push({
        date: row.date,
        value: row.metric_value,
        growthRate: row.growth_rate
      });
      return acc;
    }, {} as Record<string, any>);

    res.json({
      growth: Object.values(groupedData),
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Get audience analysis
router.get('/audience', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.query.accountId;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id, platform, account_name FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = checkResult.rows[0];

    // Get engagement patterns from chatbot conversations
    const conversationsResult = await DatabaseService.query(
      `SELECT 
         DATE_TRUNC('hour', created_at) as hour,
         COUNT(*) as message_count,
         AVG(sentiment) as avg_sentiment
       FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE_TRUNC('hour', created_at)
       ORDER BY hour`,
      [accountId]
    );

    // Get top conversation topics
    const topicsResult = await DatabaseService.query(
      `SELECT message FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       LIMIT 100`,
      [accountId]
    );

    // Simple keyword extraction for topics
    const messages = topicsResult.rows.map(row => row.message.toLowerCase());
    const words = messages.join(' ').split(/\s+/);
    const wordCount = words.reduce((acc, word) => {
      if (word.length > 3 && !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'said', 'each', 'which', 'their'].includes(word)) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topTopics = Object.entries(wordCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([word, count]) => ({ topic: word, mentions: count }));

    // Engagement by time of day
    const engagementByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourData = conversationsResult.rows.filter(row => 
        new Date(row.hour).getHours() === hour
      );
      
      return {
        hour,
        messageCount: hourData.reduce((sum, row) => sum + parseInt(row.message_count), 0),
        avgSentiment: hourData.length > 0 ? 
          hourData.reduce((sum, row) => sum + parseFloat(row.avg_sentiment || '0'), 0) / hourData.length : 0
      };
    });

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        name: account.account_name
      },
      engagementByHour,
      topTopics,
      totalConversations: conversationsResult.rows.reduce((sum, row) => sum + parseInt(row.message_count), 0),
      avgSentiment: conversationsResult.rows.length > 0 ?
        conversationsResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_sentiment || '0'), 0) / conversationsResult.rows.length : 0
    });
  } catch (error) {
    next(error);
  }
});

// Get performance comparison
router.get('/compare', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;

    // Get all accounts with their latest metrics
    const result = await DatabaseService.query(
      `SELECT 
         sa.id,
         sa.platform,
         sa.account_name,
         ad.metric_type,
         ad.metric_value,
         ROW_NUMBER() OVER (PARTITION BY sa.id, ad.metric_type ORDER BY ad.date DESC) as rn
       FROM social_accounts sa
       LEFT JOIN analytics_data ad ON sa.id = ad.account_id
       WHERE sa.user_id = $1 AND sa.is_active = true
         AND (ad.date IS NULL OR ad.date >= CURRENT_DATE - INTERVAL '${days} days')`,
      [userId]
    );

    // Get only the latest metrics for each account
    const latestMetrics = result.rows.filter(row => row.rn === 1 || row.rn === null);

    // Group by account
    const accountComparison = latestMetrics.reduce((acc, row) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          platform: row.platform,
          name: row.account_name,
          metrics: {}
        };
      }
      
      if (row.metric_type) {
        acc[row.id].metrics[row.metric_type] = row.metric_value;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate platform averages
    const platformStats = Object.values(accountComparison).reduce((acc, account: any) => {
      const platform = account.platform;
      if (!acc[platform]) {
        acc[platform] = {
          count: 0,
          totalFollowers: 0,
          totalPosts: 0,
          totalEngagement: 0
        };
      }
      
      acc[platform].count++;
      acc[platform].totalFollowers += account.metrics.followers || 0;
      acc[platform].totalPosts += account.metrics.posts || 0;
      acc[platform].totalEngagement += account.metrics.likes || 0;
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      stats.avgFollowers = Math.round(stats.totalFollowers / stats.count);
      stats.avgPosts = Math.round(stats.totalPosts / stats.count);
      stats.avgEngagement = Math.round(stats.totalEngagement / stats.count);
    });

    res.json({
      accounts: Object.values(accountComparison),
      platformAverages: platformStats,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

export { router as analyticsRoutes };