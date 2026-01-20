import axios from 'axios';
import { DatabaseService } from './DatabaseService';
import { RedisService } from './RedisService';

interface ChatbotMessage {
  accountId: number;
  userHandle: string;
  message: string;
  platform: string;
}

interface ChatbotResponse {
  response: string;
  sentiment: number;
  shouldReply: boolean;
}

export class ChatbotService {
  private static readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  
  static async processMessage(messageData: ChatbotMessage): Promise<ChatbotResponse> {
    try {
      // Check if we should respond to this user (rate limiting)
      const shouldRespond = await this.checkRateLimit(messageData.accountId, messageData.userHandle);
      if (!shouldRespond) {
        return {
          response: '',
          sentiment: 0,
          shouldReply: false
        };
      }

      // Analyze sentiment
      const sentiment = await this.analyzeSentiment(messageData.message);
      
      // Generate response based on context and sentiment
      const response = await this.generateResponse(messageData, sentiment);
      
      // Store conversation
      await this.storeConversation(messageData, response, sentiment);
      
      // Update rate limit
      await this.updateRateLimit(messageData.accountId, messageData.userHandle);

      return {
        response,
        sentiment,
        shouldReply: true
      };
    } catch (error) {
      console.error('Error processing chatbot message:', error);
      throw error;
    }
  }

  private static async checkRateLimit(accountId: number, userHandle: string): Promise<boolean> {
    const key = `rate_limit:${accountId}:${userHandle}`;
    const count = await RedisService.get(key);
    
    // Allow max 3 responses per hour per user
    return !count || parseInt(count) < 3;
  }

  private static async updateRateLimit(accountId: number, userHandle: string): Promise<void> {
    const key = `rate_limit:${accountId}:${userHandle}`;
    const current = await RedisService.get(key);
    const newCount = current ? parseInt(current) + 1 : 1;
    
    // Set expiry to 1 hour
    await RedisService.set(key, newCount.toString(), 3600);
  }

  private static async analyzeSentiment(message: string): Promise<number> {
    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Analyze the sentiment of the following message and return a score between -1 (very negative) and 1 (very positive). Return only the numeric score.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 10,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const sentimentScore = parseFloat(response.data.choices[0].message.content.trim());
      return isNaN(sentimentScore) ? 0 : Math.max(-1, Math.min(1, sentimentScore));
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 0; // Neutral sentiment as fallback
    }
  }

  private static async generateResponse(messageData: ChatbotMessage, sentiment: number): Promise<string> {
    try {
      // Get conversation history for context
      const historyResult = await DatabaseService.query(
        `SELECT message, response FROM chatbot_conversations 
         WHERE account_id = $1 AND user_handle = $2 
         ORDER BY created_at DESC LIMIT 5`,
        [messageData.accountId, messageData.userHandle]
      );

      const conversationHistory = historyResult.rows
        .reverse()
        .map(row => `User: ${row.message}\nBot: ${row.response}`)
        .join('\n');

      // Get account context
      const accountResult = await DatabaseService.query(
        'SELECT account_name, platform FROM social_accounts WHERE id = $1',
        [messageData.accountId]
      );
      
      const account = accountResult.rows[0];
      
      const systemPrompt = `You are a helpful social media assistant for ${account.account_name} on ${account.platform}. 
      
      Guidelines:
      - Be friendly, professional, and helpful
      - Keep responses concise (under 280 characters for Twitter)
      - Match the tone of the platform
      - If sentiment is negative (${sentiment}), be extra empathetic
      - Don't provide personal information or make promises you can't keep
      - If you can't help, politely direct them to customer service
      
      Previous conversation:
      ${conversationHistory}`;

      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: messageData.message
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Fallback responses based on sentiment
      if (sentiment < -0.3) {
        return "I'm sorry to hear you're having trouble. Let me help you with that! 🙏";
      } else if (sentiment > 0.3) {
        return "Thank you for your positive feedback! We're glad to help! 😊";
      } else {
        return "Thanks for reaching out! How can I assist you today?";
      }
    }
  }

  private static async storeConversation(
    messageData: ChatbotMessage, 
    response: string, 
    sentiment: number
  ): Promise<void> {
    await DatabaseService.query(
      `INSERT INTO chatbot_conversations (account_id, user_handle, message, response, sentiment)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageData.accountId, messageData.userHandle, messageData.message, response, sentiment]
    );
  }

  static async getConversationStats(accountId: number, days: number = 7): Promise<any> {
    const result = await DatabaseService.query(
      `SELECT 
         COUNT(*) as total_conversations,
         AVG(sentiment) as avg_sentiment,
         COUNT(CASE WHEN sentiment > 0.3 THEN 1 END) as positive_conversations,
         COUNT(CASE WHEN sentiment < -0.3 THEN 1 END) as negative_conversations
       FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`,
      [accountId]
    );

    return result.rows[0];
  }

  static async getTopics(accountId: number, days: number = 7): Promise<string[]> {
    // This would ideally use NLP to extract topics, but for now return common keywords
    const result = await DatabaseService.query(
      `SELECT message FROM chatbot_conversations 
       WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`,
      [accountId]
    );

    // Simple keyword extraction (in production, use proper NLP)
    const messages = result.rows.map(row => row.message.toLowerCase());
    const words = messages.join(' ').split(/\s+/);
    const wordCount = words.reduce((acc, word) => {
      if (word.length > 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([word]) => word);
  }
}