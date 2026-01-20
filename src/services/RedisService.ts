import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private static client: RedisClientType;

  static async initialize(): Promise<void> {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await this.client.connect();
    console.log('✅ Redis connected successfully');
  }

  static async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    if (expireInSeconds) {
      await this.client.setEx(key, expireInSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  static async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  static async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  static async setHash(key: string, field: string, value: string): Promise<void> {
    await this.client.hSet(key, field, value);
  }

  static async getHash(key: string, field: string): Promise<string | undefined> {
    return await this.client.hGet(key, field);
  }

  static async getAllHash(key: string): Promise<Record<string, string>> {
    return await this.client.hGetAll(key);
  }

  static async addToSet(key: string, value: string): Promise<void> {
    await this.client.sAdd(key, value);
  }

  static async getSet(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  static async removeFromSet(key: string, value: string): Promise<void> {
    await this.client.sRem(key, value);
  }

  static async close(): Promise<void> {
    await this.client.quit();
  }
}