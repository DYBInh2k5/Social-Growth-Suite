import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';

interface ScheduledPost {
  id: number;
  content: string;
  media_urls?: string[];
  platform: string;
  access_token?: string;
  account_data?: any;
}

interface AnalyticsMetric {
  type: string;
  value: number;
}

export class SocialMediaService {
  private static browser: Browser | null = null;

  static async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  static async publishPost(post: ScheduledPost): Promise<void> {
    switch (post.platform.toLowerCase()) {
      case 'twitter':
        await this.publishToTwitter(post);
        break;
      case 'facebook':
        await this.publishToFacebook(post);
        break;
      case 'instagram':
        await this.publishToInstagram(post);
        break;
      case 'linkedin':
        await this.publishToLinkedIn(post);
        break;
      default:
        throw new Error(`Unsupported platform: ${post.platform}`);
    }
  }

  private static async publishToTwitter(post: ScheduledPost): Promise<void> {
    try {
      // Using Twitter API v2
      const response = await axios.post(
        'https://api.twitter.com/2/tweets',
        {
          text: post.content,
          ...(post.media_urls && post.media_urls.length > 0 && {
            media: { media_ids: post.media_urls }
          })
        },
        {
          headers: {
            'Authorization': `Bearer ${post.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Twitter post published:', response.data);
    } catch (error) {
      console.error('Twitter publish error:', error);
      throw error;
    }
  }

  private static async publishToFacebook(post: ScheduledPost): Promise<void> {
    try {
      const pageId = post.account_data?.page_id;
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          message: post.content,
          access_token: post.access_token
        }
      );
      
      console.log('Facebook post published:', response.data);
    } catch (error) {
      console.error('Facebook publish error:', error);
      throw error;
    }
  }

  private static async publishToInstagram(post: ScheduledPost): Promise<void> {
    try {
      // Instagram Basic Display API or Instagram Graph API
      const instagramAccountId = post.account_data?.instagram_account_id;
      
      if (post.media_urls && post.media_urls.length > 0) {
        // Create media container
        const mediaResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
          {
            image_url: post.media_urls[0],
            caption: post.content,
            access_token: post.access_token
          }
        );

        // Publish media
        const publishResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
          {
            creation_id: mediaResponse.data.id,
            access_token: post.access_token
          }
        );
        
        console.log('Instagram post published:', publishResponse.data);
      }
    } catch (error) {
      console.error('Instagram publish error:', error);
      throw error;
    }
  }

  private static async publishToLinkedIn(post: ScheduledPost): Promise<void> {
    try {
      const personUrn = post.account_data?.person_urn;
      
      const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          author: personUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: post.content
              },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${post.access_token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );
      
      console.log('LinkedIn post published:', response.data);
    } catch (error) {
      console.error('LinkedIn publish error:', error);
      throw error;
    }
  }

  static async getAnalytics(account: any): Promise<AnalyticsMetric[]> {
    const metrics: AnalyticsMetric[] = [];

    try {
      switch (account.platform.toLowerCase()) {
        case 'twitter':
          const twitterMetrics = await this.getTwitterAnalytics(account);
          metrics.push(...twitterMetrics);
          break;
        case 'facebook':
          const facebookMetrics = await this.getFacebookAnalytics(account);
          metrics.push(...facebookMetrics);
          break;
        case 'instagram':
          const instagramMetrics = await this.getInstagramAnalytics(account);
          metrics.push(...instagramMetrics);
          break;
      }
    } catch (error) {
      console.error(`Error getting analytics for ${account.platform}:`, error);
    }

    return metrics;
  }

  private static async getTwitterAnalytics(account: any): Promise<AnalyticsMetric[]> {
    // Twitter API v2 analytics
    const response = await axios.get(
      `https://api.twitter.com/2/users/me?user.fields=public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      }
    );

    const metrics = response.data.data.public_metrics;
    return [
      { type: 'followers', value: metrics.followers_count },
      { type: 'following', value: metrics.following_count },
      { type: 'tweets', value: metrics.tweet_count },
      { type: 'likes', value: metrics.like_count }
    ];
  }

  private static async getFacebookAnalytics(account: any): Promise<AnalyticsMetric[]> {
    const pageId = account.account_data?.page_id;
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}?fields=followers_count,fan_count&access_token=${account.access_token}`
    );

    return [
      { type: 'followers', value: response.data.followers_count || 0 },
      { type: 'likes', value: response.data.fan_count || 0 }
    ];
  }

  private static async getInstagramAnalytics(account: any): Promise<AnalyticsMetric[]> {
    const instagramAccountId = account.account_data?.instagram_account_id;
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${instagramAccountId}?fields=followers_count,media_count&access_token=${account.access_token}`
    );

    return [
      { type: 'followers', value: response.data.followers_count || 0 },
      { type: 'posts', value: response.data.media_count || 0 }
    ];
  }

  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}