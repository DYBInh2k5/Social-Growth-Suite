import { Router } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { ChatbotService } from '../services/ChatbotService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Process incoming message (webhook endpoint)
router.post('/message', async (req, res, next) => {
  try {
    const { accountId, userHandle, message, platform } = req.body;

    if (!accountId || !userHandle || !message || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify account exists
    const accountResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND is_active = true',
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    // Process message with chatbot
    const response = await ChatbotService.processMessage({
      accountId: parseInt(accountId),
      userHandle,
      message,
      platform
    });

    res.json({
      success: true,
      shouldReply: response.shouldReply,
      response: response.response,
      sentiment: response.sentiment
    });
  } catch (error) {
    next(error);
  }
});

// Get conversation history
router.get('/conversations/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get conversations
    const result = await DatabaseService.query(
      `SELECT user_handle, message, response, sentiment, created_at
       FROM chatbot_conversations 
       WHERE account_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    // Get total count
    const countResult = await DatabaseService.query(
      'SELECT COUNT(*) FROM chatbot_conversations WHERE account_id = $1',
      [accountId]
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      conversations: result.rows,
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

// Get conversation statistics
router.get('/stats/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const days = parseInt(req.query.days as string) || 7;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id, platform, account_name FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = checkResult.rows[0];

    // Get conversation stats
    const stats = await ChatbotService.getConversationStats(parseInt(accountId), days);
    
    // Get top topics
    const topics = await ChatbotService.getTopics(parseInt(accountId), days);

    // Get daily conversation counts
    const dailyResult = await DatabaseService.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as conversation_count,
         AVG(sentiment) as avg_sentiment
       FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [accountId]
    );

    // Get hourly distribution
    const hourlyResult = await DatabaseService.query(
      `SELECT 
         EXTRACT(HOUR FROM created_at) as hour,
         COUNT(*) as conversation_count
       FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [accountId]
    );

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        name: account.account_name
      },
      stats: {
        totalConversations: parseInt(stats.total_conversations || '0'),
        avgSentiment: parseFloat(stats.avg_sentiment || '0'),
        positiveConversations: parseInt(stats.positive_conversations || '0'),
        negativeConversations: parseInt(stats.negative_conversations || '0')
      },
      topTopics: topics,
      dailyStats: dailyResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.conversation_count),
        avgSentiment: parseFloat(row.avg_sentiment || '0')
      })),
      hourlyDistribution: hourlyResult.rows.map(row => ({
        hour: parseInt(row.hour),
        count: parseInt(row.conversation_count)
      })),
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Get conversation by user handle
router.get('/conversations/:accountId/user/:userHandle', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const userHandle = req.params.userHandle;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get conversation history for specific user
    const result = await DatabaseService.query(
      `SELECT message, response, sentiment, created_at
       FROM chatbot_conversations 
       WHERE account_id = $1 AND user_handle = $2
       ORDER BY created_at ASC`,
      [accountId, userHandle]
    );

    res.json({
      userHandle,
      conversations: result.rows,
      totalMessages: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Update chatbot settings (future feature)
router.put('/settings/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { autoReply, responseDelay, maxResponsesPerHour, customPrompt } = req.body;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // For now, store settings in account_data JSON field
    const currentResult = await DatabaseService.query(
      'SELECT account_data FROM social_accounts WHERE id = $1',
      [accountId]
    );

    const currentData = currentResult.rows[0].account_data || {};
    const updatedData = {
      ...currentData,
      chatbotSettings: {
        autoReply: autoReply !== undefined ? autoReply : currentData.chatbotSettings?.autoReply,
        responseDelay: responseDelay !== undefined ? responseDelay : currentData.chatbotSettings?.responseDelay,
        maxResponsesPerHour: maxResponsesPerHour !== undefined ? maxResponsesPerHour : currentData.chatbotSettings?.maxResponsesPerHour,
        customPrompt: customPrompt !== undefined ? customPrompt : currentData.chatbotSettings?.customPrompt
      }
    };

    await DatabaseService.query(
      'UPDATE social_accounts SET account_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(updatedData), accountId]
    );

    res.json({
      message: 'Chatbot settings updated successfully',
      settings: updatedData.chatbotSettings
    });
  } catch (error) {
    next(error);
  }
});

// Get chatbot settings
router.get('/settings/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;

    // Verify account belongs to user
    const result = await DatabaseService.query(
      'SELECT account_data FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const accountData = result.rows[0].account_data || {};
    const settings = accountData.chatbotSettings || {
      autoReply: true,
      responseDelay: 30, // seconds
      maxResponsesPerHour: 10,
      customPrompt: null
    };

    res.json({
      settings
    });
  } catch (error) {
    next(error);
  }
});

export { router as chatbotRoutes };