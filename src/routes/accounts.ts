import { Router } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all social accounts for user
router.get('/', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;

    const result = await DatabaseService.query(
      `SELECT id, platform, account_name, is_active, created_at, updated_at
       FROM social_accounts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      accounts: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Add new social account
router.post('/', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const { platform, accountName, accessToken, refreshToken, accountData } = req.body;

    if (!platform || !accountName) {
      return res.status(400).json({ error: 'Platform and account name are required' });
    }

    const result = await DatabaseService.query(
      `INSERT INTO social_accounts (user_id, platform, account_name, access_token, refresh_token, account_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, platform, account_name, is_active, created_at`,
      [userId, platform, accountName, accessToken, refreshToken, JSON.stringify(accountData)]
    );

    res.status(201).json({
      message: 'Social account added successfully',
      account: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Update social account
router.put('/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { accountName, accessToken, refreshToken, accountData, isActive } = req.body;

    // Verify account belongs to user
    const checkResult = await DatabaseService.query(
      'SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const result = await DatabaseService.query(
      `UPDATE social_accounts 
       SET account_name = COALESCE($1, account_name),
           access_token = COALESCE($2, access_token),
           refresh_token = COALESCE($3, refresh_token),
           account_data = COALESCE($4, account_data),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7
       RETURNING id, platform, account_name, is_active, updated_at`,
      [
        accountName,
        accessToken,
        refreshToken,
        accountData ? JSON.stringify(accountData) : null,
        isActive,
        accountId,
        userId
      ]
    );

    res.json({
      message: 'Account updated successfully',
      account: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Delete social account
router.delete('/:accountId', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;

    const result = await DatabaseService.query(
      'DELETE FROM social_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get account analytics summary
router.get('/:accountId/analytics', authenticateToken, async (req: any, res, next) => {
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

    // Get analytics data
    const analyticsResult = await DatabaseService.query(
      `SELECT metric_type, metric_value, date
       FROM analytics_data 
       WHERE account_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`,
      [accountId]
    );

    // Group by metric type
    const metrics = analyticsResult.rows.reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.metric_type]) {
        acc[row.metric_type] = [];
      }
      acc[row.metric_type].push({
        value: row.metric_value,
        date: row.date
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        name: account.account_name
      },
      metrics,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Test account connection
router.post('/:accountId/test', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;

    // Verify account belongs to user
    const result = await DatabaseService.query(
      'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];

    // Test connection based on platform
    // This would make actual API calls to verify the tokens
    let connectionStatus = 'connected';
    let message = 'Account connection is working';

    try {
      // Add platform-specific connection tests here
      // For now, just check if we have access token
      if (!account.access_token) {
        connectionStatus = 'disconnected';
        message = 'No access token found';
      }
    } catch (error) {
      connectionStatus = 'error';
      message = 'Connection test failed';
    }

    res.json({
      status: connectionStatus,
      message,
      platform: account.platform,
      accountName: account.account_name
    });
  } catch (error) {
    next(error);
  }
});

export { router as accountRoutes };