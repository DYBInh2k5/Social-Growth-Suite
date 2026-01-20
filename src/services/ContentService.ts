import axios from 'axios';
import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';

interface ContentSuggestion {
  title: string;
  content: string;
  hashtags: string[];
  bestTime: string;
  platform: string;
  category: string;
}

interface TrendingTopic {
  keyword: string;
  volume: number;
  trend: 'rising' | 'stable' | 'declining';
  platforms: string[];
}

export class ContentService {
  
  static async generateContentSuggestions(
    userId: number, 
    platform: string, 
    category?: string,
    count: number = 5
  ): Promise<ContentSuggestion[]> {
    try {
      // Get user's account data for context
      const accountResult = await DatabaseService.query(
        'SELECT * FROM social_accounts WHERE user_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
        [userId, platform]
      );

      if (accountResult.rows.length === 0) {
        throw new Error(`No active ${platform} account found`);
      }

      const account = accountResult.rows[0];

      // Get recent successful posts for context
      const recentPostsResult = await DatabaseService.query(
        `SELECT content FROM scheduled_posts sp
         JOIN chatbot_conversations cc ON DATE(cc.created_at) = DATE(sp.posted_at)
         WHERE sp.account_id = $1 AND sp.status = 'published'
           AND sp.posted_at >= NOW() - INTERVAL '30 days'
         GROUP BY sp.content
         HAVING AVG(cc.sentiment) > 0.2
         ORDER BY COUNT(cc.id) DESC
         LIMIT 3`,
        [account.id]
      );

      const successfulContent = recentPostsResult.rows.map(row => row.content);

      // Get trending topics
      const trendingTopics = await this.getTrendingTopics(platform);

      // Generate content using AI
      const suggestions = await this.generateAIContent(
        platform,
        category,
        successfulContent,
        trendingTopics,
        count
      );

      // Get optimal posting times
      const optimalTimes = await this.getOptimalPostingTimes(account.id);

      return suggestions.map((suggestion, index) => ({
        ...suggestion,
        bestTime: optimalTimes[index % optimalTimes.length] || '12:00',
        platform
      }));

    } catch (error) {
      console.error('Error generating content suggestions:', error);
      throw error;
    }
  }

  private static async generateAIContent(
    platform: string,
    category: string = 'general',
    successfulContent: string[],
    trendingTopics: TrendingTopic[],
    count: number
  ): Promise<Omit<ContentSuggestion, 'bestTime' | 'platform'>[]> {
    
    const contextPrompt = `
    Tạo ${count} ý tưởng nội dung cho ${platform} trong danh mục ${category}.
    
    Nội dung thành công trước đây:
    ${successfulContent.join('\n')}
    
    Chủ đề đang trending:
    ${trendingTopics.map(t => `- ${t.keyword} (${t.trend})`).join('\n')}
    
    Yêu cầu:
    - Nội dung phù hợp với ${platform}
    - Tích cực, hấp dẫn và có tính tương tác cao
    - Bao gồm hashtags phù hợp
    - Độ dài phù hợp với platform
    
    Trả về JSON array với format:
    [
      {
        "title": "Tiêu đề ngắn gọn",
        "content": "Nội dung đầy đủ",
        "hashtags": ["hashtag1", "hashtag2"],
        "category": "danh mục"
      }
    ]
    `;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Bạn là chuyên gia content marketing, tạo nội dung viral cho social media.'
            },
            {
              role: 'user',
              content: contextPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.8
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      
      try {
        return JSON.parse(aiResponse);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return this.generateFallbackContent(platform, category, count);
      }

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return this.generateFallbackContent(platform, category, count);
    }
  }

  private static generateFallbackContent(
    platform: string, 
    category: string, 
    count: number
  ): Omit<ContentSuggestion, 'bestTime' | 'platform'>[] {
    const templates = {
      twitter: [
        {
          title: "Tip của ngày",
          content: "💡 Tip hữu ích: [Chia sẻ kinh nghiệm thực tế] \n\nBạn đã thử chưa? Chia sẻ trải nghiệm nhé! 👇",
          hashtags: ["#tips", "#lifehack", "#productivity"],
          category: "educational"
        },
        {
          title: "Câu hỏi tương tác",
          content: "🤔 Câu hỏi cho mọi người:\n\n[Đặt câu hỏi thú vị liên quan đến lĩnh vực]\n\nComment câu trả lời của bạn! 👇",
          hashtags: ["#question", "#community", "#discussion"],
          category: "engagement"
        }
      ],
      facebook: [
        {
          title: "Chia sẻ kinh nghiệm",
          content: "Hôm nay mình muốn chia sẻ với mọi người về [chủ đề]...\n\n[Nội dung chi tiết với câu chuyện cá nhân]\n\nCác bạn có trải nghiệm tương tự không? Hãy chia sẻ trong comment nhé! 💬",
          hashtags: ["#sharing", "#experience", "#community"],
          category: "personal"
        }
      ],
      instagram: [
        {
          title: "Behind the scenes",
          content: "✨ Behind the scenes của [hoạt động]\n\n[Mô tả ngắn gọn về quá trình]\n\n#BehindTheScenes #Process #Creative",
          hashtags: ["#behindthescenes", "#process", "#creative"],
          category: "lifestyle"
        }
      ]
    };

    const platformTemplates = templates[platform as keyof typeof templates] || templates.twitter;
    
    return Array.from({ length: count }, (_, index) => {
      const template = platformTemplates[index % platformTemplates.length];
      return {
        ...template,
        title: `${template.title} ${index + 1}`
      };
    });
  }

  static async getTrendingTopics(platform: string): Promise<TrendingTopic[]> {
    const cacheKey = `trending:${platform}`;
    
    try {
      // Check cache first
      const cached = await RedisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // In a real implementation, this would call actual trending APIs
      // For now, return mock trending topics
      const mockTrends: TrendingTopic[] = [
        { keyword: 'AI', volume: 1000, trend: 'rising', platforms: ['twitter', 'linkedin'] },
        { keyword: 'sustainability', volume: 800, trend: 'stable', platforms: ['instagram', 'facebook'] },
        { keyword: 'remote work', volume: 600, trend: 'declining', platforms: ['linkedin', 'twitter'] },
        { keyword: 'wellness', volume: 900, trend: 'rising', platforms: ['instagram', 'facebook'] },
        { keyword: 'technology', volume: 1200, trend: 'stable', platforms: ['twitter', 'linkedin'] }
      ];

      const platformTrends = mockTrends.filter(trend => 
        trend.platforms.includes(platform)
      );

      // Cache for 1 hour
      await RedisService.set(cacheKey, JSON.stringify(platformTrends), 3600);
      
      return platformTrends;

    } catch (error) {
      console.error('Error getting trending topics:', error);
      return [];
    }
  }

  private static async getOptimalPostingTimes(accountId: number): Promise<string[]> {
    try {
      // Analyze when posts get most engagement
      const result = await DatabaseService.query(
        `SELECT 
           EXTRACT(HOUR FROM cc.created_at) as hour,
           COUNT(*) as interaction_count
         FROM chatbot_conversations cc
         WHERE cc.account_id = $1 
           AND cc.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY EXTRACT(HOUR FROM cc.created_at)
         ORDER BY interaction_count DESC
         LIMIT 5`,
        [accountId]
      );

      if (result.rows.length > 0) {
        return result.rows.map(row => `${row.hour}:00`);
      }

      // Default optimal times if no data
      return ['09:00', '12:00', '15:00', '18:00', '21:00'];

    } catch (error) {
      console.error('Error getting optimal posting times:', error);
      return ['12:00'];
    }
  }

  static async analyzeContentPerformance(accountId: number, days: number = 30): Promise<any> {
    try {
      const query = `
        SELECT 
          sp.content,
          sp.posted_at,
          COUNT(cc.id) as interactions,
          AVG(cc.sentiment) as avg_sentiment,
          EXTRACT(HOUR FROM sp.posted_at) as post_hour,
          EXTRACT(DOW FROM sp.posted_at) as post_day
        FROM scheduled_posts sp
        LEFT JOIN chatbot_conversations cc ON DATE(cc.created_at) = DATE(sp.posted_at)
          AND cc.account_id = sp.account_id
        WHERE sp.account_id = $1 
          AND sp.status = 'published'
          AND sp.posted_at >= NOW() - INTERVAL '${days} days'
        GROUP BY sp.id, sp.content, sp.posted_at
        ORDER BY interactions DESC, avg_sentiment DESC NULLS LAST
      `;

      const result = await DatabaseService.query(query, [accountId]);

      // Analyze patterns
      const hourlyPerformance = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        avgInteractions: 0,
        avgSentiment: 0,
        postCount: 0
      }));

      const weeklyPerformance = Array.from({ length: 7 }, (_, day) => ({
        day: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][day],
        avgInteractions: 0,
        avgSentiment: 0,
        postCount: 0
      }));

      result.rows.forEach(row => {
        const hour = parseInt(row.post_hour);
        const day = parseInt(row.post_day);
        const interactions = parseInt(row.interactions) || 0;
        const sentiment = parseFloat(row.avg_sentiment) || 0;

        hourlyPerformance[hour].avgInteractions += interactions;
        hourlyPerformance[hour].avgSentiment += sentiment;
        hourlyPerformance[hour].postCount++;

        weeklyPerformance[day].avgInteractions += interactions;
        weeklyPerformance[day].avgSentiment += sentiment;
        weeklyPerformance[day].postCount++;
      });

      // Calculate averages
      hourlyPerformance.forEach(hour => {
        if (hour.postCount > 0) {
          hour.avgInteractions = hour.avgInteractions / hour.postCount;
          hour.avgSentiment = hour.avgSentiment / hour.postCount;
        }
      });

      weeklyPerformance.forEach(day => {
        if (day.postCount > 0) {
          day.avgInteractions = day.avgInteractions / day.postCount;
          day.avgSentiment = day.avgSentiment / day.postCount;
        }
      });

      // Extract top performing content patterns
      const topPosts = result.rows.slice(0, 10).map(row => ({
        content: row.content.substring(0, 100) + '...',
        interactions: parseInt(row.interactions) || 0,
        sentiment: parseFloat(row.avg_sentiment) || 0,
        postedAt: row.posted_at
      }));

      return {
        topPosts,
        hourlyPerformance: hourlyPerformance.sort((a, b) => b.avgInteractions - a.avgInteractions),
        weeklyPerformance: weeklyPerformance.sort((a, b) => b.avgInteractions - a.avgInteractions),
        totalPosts: result.rows.length,
        avgInteractions: result.rows.reduce((sum, row) => sum + (parseInt(row.interactions) || 0), 0) / result.rows.length,
        avgSentiment: result.rows.reduce((sum, row) => sum + (parseFloat(row.avg_sentiment) || 0), 0) / result.rows.length
      };

    } catch (error) {
      console.error('Error analyzing content performance:', error);
      throw error;
    }
  }

  static async generateHashtagSuggestions(content: string, platform: string): Promise<string[]> {
    try {
      const prompt = `
      Dựa vào nội dung sau, đề xuất 5-10 hashtags phù hợp cho ${platform}:
      
      "${content}"
      
      Yêu cầu:
      - Hashtags phổ biến và có tương tác cao
      - Phù hợp với nội dung
      - Không quá dài
      - Bao gồm cả hashtags chung và hashtags cụ thể
      
      Trả về danh sách hashtags, mỗi hashtag một dòng, bắt đầu bằng #
      `;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Bạn là chuyên gia hashtag cho social media marketing.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const hashtags = aiResponse
        .split('\n')
        .filter((line: string) => line.trim().startsWith('#'))
        .map((line: string) => line.trim())
        .slice(0, 10);

      return hashtags.length > 0 ? hashtags : this.getFallbackHashtags(platform);

    } catch (error) {
      console.error('Error generating hashtag suggestions:', error);
      return this.getFallbackHashtags(platform);
    }
  }

  private static getFallbackHashtags(platform: string): string[] {
    const fallbackHashtags = {
      twitter: ['#socialmedia', '#marketing', '#business', '#tips', '#growth'],
      facebook: ['#community', '#sharing', '#lifestyle', '#inspiration', '#connect'],
      instagram: ['#photooftheday', '#instagood', '#lifestyle', '#inspiration', '#creative'],
      linkedin: ['#professional', '#business', '#networking', '#career', '#industry']
    };

    return fallbackHashtags[platform as keyof typeof fallbackHashtags] || fallbackHashtags.twitter;
  }
}