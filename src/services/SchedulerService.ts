import { CronJob } from 'cron';
import { DatabaseService } from './DatabaseService';
import { SocialMediaService } from './SocialMediaService';

export class SchedulerService {
  private static jobs: Map<string, CronJob> = new Map();

  static start(): void {
    // Check for scheduled posts every minute
    const postSchedulerJob = new CronJob('0 * * * * *', async () => {
      await this.processScheduledPosts();
    });

    // Collect analytics data every hour
    const analyticsJob = new CronJob('0 0 * * * *', async () => {
      await this.collectAnalytics();
    });

    // Clean up old data daily at midnight
    const cleanupJob = new CronJob('0 0 0 * * *', async () => {
      await this.cleanupOldData();
    });

    postSchedulerJob.start();
    analyticsJob.start();
    cleanupJob.start();

    this.jobs.set('postScheduler', postSchedulerJob);
    this.jobs.set('analytics', analyticsJob);
    this.jobs.set('cleanup', cleanupJob);

    console.log('✅ Scheduler service started');
  }

  private static async processScheduledPosts(): Promise<void> {
    try {
      const query = `
        SELECT sp.*, sa.platform, sa.access_token, sa.account_data
        FROM scheduled_posts sp
        JOIN social_accounts sa ON sp.account_id = sa.id
        WHERE sp.status = 'pending' 
        AND sp.scheduled_time <= NOW()
        ORDER BY sp.scheduled_time ASC
        LIMIT 10
      `;

      const result = await DatabaseService.query(query);
      
      for (const post of result.rows) {
        try {
          await SocialMediaService.publishPost(post);
          
          await DatabaseService.query(
            'UPDATE scheduled_posts SET status = $1, posted_at = NOW() WHERE id = $2',
            ['published', post.id]
          );
          
          console.log(`✅ Published scheduled post ${post.id}`);
        } catch (error) {
          console.error(`❌ Failed to publish post ${post.id}:`, error);
          
          await DatabaseService.query(
            'UPDATE scheduled_posts SET status = $1 WHERE id = $2',
            ['failed', post.id]
          );
        }
      }
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  private static async collectAnalytics(): Promise<void> {
    try {
      const accountsResult = await DatabaseService.query(
        'SELECT * FROM social_accounts WHERE is_active = true'
      );

      for (const account of accountsResult.rows) {
        try {
          const analytics = await SocialMediaService.getAnalytics(account);
          
          for (const metric of analytics) {
            await DatabaseService.query(
              `INSERT INTO analytics_data (account_id, metric_type, metric_value, date)
               VALUES ($1, $2, $3, CURRENT_DATE)
               ON CONFLICT (account_id, metric_type, date) 
               DO UPDATE SET metric_value = $3`,
              [account.id, metric.type, metric.value]
            );
          }
          
          console.log(`✅ Collected analytics for account ${account.id}`);
        } catch (error) {
          console.error(`❌ Failed to collect analytics for account ${account.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error collecting analytics:', error);
    }
  }

  private static async cleanupOldData(): Promise<void> {
    try {
      // Clean up old analytics data (older than 1 year)
      await DatabaseService.query(
        'DELETE FROM analytics_data WHERE created_at < NOW() - INTERVAL \'1 year\''
      );

      // Clean up old chatbot conversations (older than 6 months)
      await DatabaseService.query(
        'DELETE FROM chatbot_conversations WHERE created_at < NOW() - INTERVAL \'6 months\''
      );

      // Clean up failed scheduled posts (older than 1 week)
      await DatabaseService.query(
        'DELETE FROM scheduled_posts WHERE status = \'failed\' AND created_at < NOW() - INTERVAL \'1 week\''
      );

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  static stop(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
    this.jobs.clear();
  }
}