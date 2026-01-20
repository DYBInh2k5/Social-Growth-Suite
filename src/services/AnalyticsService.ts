import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';
import { SocialMediaService } from './SocialMediaService';

interface AnalyticsMetric {
  type: string;
  value: number;
  date: string;
  accountId: number;
}

interface GrowthData {
  current: number;
  previous: number;
  growth: number;
  growthRate: number;
}

interface PlatformComparison {
  platform: string;
  followers: number;
  engagement: number;
  posts: number;
  growthRate: number;
}

export class AnalyticsService {
  
  static async collectAllAccountsAnalytics(userId: number): Promise<void> {
    try {
      const accountsResult = await DatabaseService.query(
        'SELECT * FROM social_accounts WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      for (const account of accountsResult.rows) {
        await this.collectAccountAnalytics(account);
      }
    } catch (error) {
      console.error('Error collecting analytics for user:', userId, error);
    }
  }

  static async collectAccountAnalytics(account: any): Promise<void> {
    try {
      const analytics = await SocialMediaService.getAnalytics(account);
      
      for (const metric of analytics) {
        await this.storeMetric({
          type: metric.type,
          value: metric.value,
          date: new Date().toISOString().split('T')[0],
          accountId: account.id
        });
      }

      // Cache latest metrics for quick access
      await this.cacheLatestMetrics(account.id, analytics);
      
    } catch (error) {
      console.error(`Error collecting analytics for account ${account.id}:`, error);
    }
  }

  private static async storeMetric(metric: AnalyticsMetric): Promise<void> {
    await DatabaseService.query(
      `INSERT INTO analytics_data (account_id, metric_type, metric_value, date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, metric_type, date) 
       DO UPDATE SET metric_value = $3, created_at = CURRENT_TIMESTAMP`,
      [metric.accountId, metric.type, metric.value, metric.date]
    );
  }

  private static async cacheLatestMetrics(accountId: number, metrics: any[]): Promise<void> {
    const cacheKey = `analytics:latest:${accountId}`;
    const metricsData = metrics.reduce((acc, metric) => {
      acc[metric.type] = metric.value;
      return acc;
    }, {} as Record<string, number>);

    await RedisService.set(cacheKey, JSON.stringify(metricsData), 3600); // Cache for 1 hour
  }

  static async getGrowthAnalytics(accountId: number, days: number = 30): Promise<Record<string, GrowthData>> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    const midDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000 / 2));

    const query = `
      SELECT 
        metric_type,
        AVG(CASE WHEN date >= $2 THEN metric_value END) as current_avg,
        AVG(CASE WHEN date >= $3 AND date < $2 THEN metric_value END) as previous_avg
      FROM analytics_data 
      WHERE account_id = $1 AND date >= $3
      GROUP BY metric_type
    `;

    const result = await DatabaseService.query(query, [
      accountId, 
      midDate.toISOString().split('T')[0],
      startDate.toISOString().split('T')[0]
    ]);

    const growthData: Record<string, GrowthData> = {};

    for (const row of result.rows) {
      const current = parseFloat(row.current_avg) || 0;
      const previous = parseFloat(row.previous_avg) || 0;
      const growth = current - previous;
      const growthRate = previous > 0 ? (growth / previous) * 100 : 0;

      growthData[row.metric_type] = {
        current,
        previous,
        growth,
        growthRate
      };
    }

    return growthData;
  }

  static async getPlatformComparison(userId: number, days: number = 30): Promise<PlatformComparison[]> {
    const query = `
      SELECT 
        sa.platform,
        sa.account_name,
        AVG(CASE WHEN ad.metric_type = 'followers' THEN ad.metric_value END) as avg_followers,
        AVG(CASE WHEN ad.metric_type = 'likes' THEN ad.metric_value END) as avg_engagement,
        AVG(CASE WHEN ad.metric_type = 'posts' THEN ad.metric_value END) as avg_posts
      FROM social_accounts sa
      LEFT JOIN analytics_data ad ON sa.id = ad.account_id
      WHERE sa.user_id = $1 AND sa.is_active = true
        AND (ad.date IS NULL OR ad.date >= CURRENT_DATE - INTERVAL '${days} days')
      GROUP BY sa.platform, sa.account_name, sa.id
      ORDER BY avg_followers DESC NULLS LAST
    `;

    const result = await DatabaseService.query(query, [userId]);
    
    return result.rows.map(row => ({
      platform: row.platform,
      followers: parseInt(row.avg_followers) || 0,
      engagement: parseInt(row.avg_engagement) || 0,
      posts: parseInt(row.avg_posts) || 0,
      growthRate: 0 // Will be calculated separately if needed
    }));
  }

  static async getEngagementTrends(accountId: number, days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        date,
        metric_type,
        metric_value
      FROM analytics_data 
      WHERE account_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        AND metric_type IN ('likes', 'comments', 'shares', 'views')
      ORDER BY date ASC
    `;

    const result = await DatabaseService.query(query, [accountId]);
    
    // Group by date and calculate engagement score
    const trendsByDate = result.rows.reduce((acc, row) => {
      const date = row.date;
      if (!acc[date]) {
        acc[date] = { date, engagement: 0, metrics: {} };
      }
      
      acc[date].metrics[row.metric_type] = row.metric_value;
      
      // Simple engagement score calculation
      const weights = { likes: 1, comments: 3, shares: 5, views: 0.1 };
      acc[date].engagement += (row.metric_value * (weights[row.metric_type as keyof typeof weights] || 1));
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(trendsByDate);
  }

  static async getTopPerformingContent(accountId: number, days: number = 30): Promise<any[]> {
    // Get scheduled posts that were published and their performance
    const query = `
      SELECT 
        sp.content,
        sp.posted_at,
        sp.media_urls,
        COUNT(cc.id) as interactions,
        AVG(cc.sentiment) as avg_sentiment
      FROM scheduled_posts sp
      LEFT JOIN chatbot_conversations cc ON DATE(cc.created_at) = DATE(sp.posted_at)
        AND cc.account_id = sp.account_id
      WHERE sp.account_id = $1 
        AND sp.status = 'published'
        AND sp.posted_at >= NOW() - INTERVAL '${days} days'
      GROUP BY sp.id, sp.content, sp.posted_at, sp.media_urls
      ORDER BY interactions DESC, avg_sentiment DESC NULLS LAST
      LIMIT 10
    `;

    const result = await DatabaseService.query(query, [accountId]);
    
    return result.rows.map(row => ({
      content: row.content.substring(0, 100) + (row.content.length > 100 ? '...' : ''),
      postedAt: row.posted_at,
      hasMedia: row.media_urls && row.media_urls.length > 0,
      interactions: parseInt(row.interactions) || 0,
      sentiment: parseFloat(row.avg_sentiment) || 0
    }));
  }

  static async getAudienceInsights(accountId: number, days: number = 30): Promise<any> {
    // Get conversation patterns to understand audience behavior
    const conversationQuery = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as message_count,
        AVG(sentiment) as avg_sentiment
      FROM chatbot_conversations 
      WHERE account_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at)
      ORDER BY message_count DESC
    `;

    const conversationResult = await DatabaseService.query(conversationQuery, [accountId]);

    // Get most active hours
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      activity: 0,
      sentiment: 0
    }));

    conversationResult.rows.forEach(row => {
      const hour = parseInt(row.hour);
      hourlyActivity[hour].activity += parseInt(row.message_count);
      hourlyActivity[hour].sentiment = parseFloat(row.avg_sentiment) || 0;
    });

    // Get day of week patterns
    const weeklyActivity = Array.from({ length: 7 }, (_, day) => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      activity: 0
    }));

    conversationResult.rows.forEach(row => {
      const day = parseInt(row.day_of_week);
      weeklyActivity[day].activity += parseInt(row.message_count);
    });

    // Get sentiment distribution
    const sentimentQuery = `
      SELECT 
        CASE 
          WHEN sentiment > 0.3 THEN 'positive'
          WHEN sentiment < -0.3 THEN 'negative'
          ELSE 'neutral'
        END as sentiment_category,
        COUNT(*) as count
      FROM chatbot_conversations 
      WHERE account_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
        AND sentiment IS NOT NULL
      GROUP BY sentiment_category
    `;

    const sentimentResult = await DatabaseService.query(sentimentQuery, [accountId]);
    
    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0
    };

    sentimentResult.rows.forEach(row => {
      sentimentDistribution[row.sentiment_category as keyof typeof sentimentDistribution] = parseInt(row.count);
    });

    return {
      hourlyActivity: hourlyActivity.sort((a, b) => b.activity - a.activity),
      weeklyActivity,
      sentimentDistribution,
      totalInteractions: conversationResult.rows.reduce((sum, row) => sum + parseInt(row.message_count), 0)
    };
  }

  static async generateInsightReport(userId: number, days: number = 30): Promise<any> {
    try {
      // Get all user accounts
      const accountsResult = await DatabaseService.query(
        'SELECT id, platform, account_name FROM social_accounts WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      const accounts = accountsResult.rows;
      const insights = [];

      for (const account of accounts) {
        const growthData = await this.getGrowthAnalytics(account.id, days);
        const engagementTrends = await this.getEngagementTrends(account.id, days);
        const topContent = await this.getTopPerformingContent(account.id, days);
        const audienceInsights = await this.getAudienceInsights(account.id, days);

        insights.push({
          account: {
            id: account.id,
            platform: account.platform,
            name: account.account_name
          },
          growth: growthData,
          engagement: engagementTrends,
          topContent,
          audience: audienceInsights
        });
      }

      // Generate summary insights
      const summary = this.generateSummaryInsights(insights);

      return {
        period: `${days} days`,
        accounts: insights,
        summary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating insight report:', error);
      throw error;
    }
  }

  private static generateSummaryInsights(accountInsights: any[]): any {
    const totalAccounts = accountInsights.length;
    let totalFollowers = 0;
    let totalEngagement = 0;
    let avgSentiment = 0;
    let bestPerformingPlatform = '';
    let maxFollowers = 0;

    accountInsights.forEach(insight => {
      const followers = insight.growth.followers?.current || 0;
      totalFollowers += followers;
      
      if (followers > maxFollowers) {
        maxFollowers = followers;
        bestPerformingPlatform = insight.account.platform;
      }

      totalEngagement += insight.audience.totalInteractions || 0;
      avgSentiment += insight.audience.sentimentDistribution?.positive || 0;
    });

    return {
      totalAccounts,
      totalFollowers,
      totalEngagement,
      avgSentiment: totalAccounts > 0 ? avgSentiment / totalAccounts : 0,
      bestPerformingPlatform,
      recommendations: this.generateRecommendations(accountInsights)
    };
  }

  private static generateRecommendations(accountInsights: any[]): string[] {
    const recommendations = [];

    // Analyze posting times
    const allHourlyData = accountInsights.flatMap(insight => 
      insight.audience.hourlyActivity || []
    );
    
    if (allHourlyData.length > 0) {
      const bestHour = allHourlyData.reduce((best, current) => 
        current.activity > best.activity ? current : best
      );
      recommendations.push(`Tốt nhất nên đăng bài vào ${bestHour.hour}:00 để có tương tác cao nhất`);
    }

    // Analyze sentiment
    accountInsights.forEach(insight => {
      const sentiment = insight.audience.sentimentDistribution;
      if (sentiment && sentiment.negative > sentiment.positive) {
        recommendations.push(`Tài khoản ${insight.account.name} cần cải thiện nội dung để tăng sentiment tích cực`);
      }
    });

    // Growth recommendations
    accountInsights.forEach(insight => {
      const followersGrowth = insight.growth.followers?.growthRate || 0;
      if (followersGrowth < 0) {
        recommendations.push(`Tài khoản ${insight.account.name} đang mất followers, cần xem xét lại chiến lược content`);
      }
    });

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }
}