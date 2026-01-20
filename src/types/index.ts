export interface User {
  id: number;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface SocialAccount {
  id: number;
  user_id: number;
  platform: SocialPlatform;
  account_name: string;
  access_token?: string;
  refresh_token?: string;
  account_data?: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube';

export interface ScheduledPost {
  id: number;
  user_id: number;
  account_id: number;
  content: string;
  media_urls?: string[];
  scheduled_time: Date;
  status: PostStatus;
  posted_at?: Date;
  created_at: Date;
}

export type PostStatus = 'pending' | 'published' | 'failed' | 'cancelled';

export interface AnalyticsData {
  id: number;
  account_id: number;
  metric_type: MetricType;
  metric_value: number;
  date: Date;
  created_at: Date;
}

export type MetricType = 'followers' | 'following' | 'posts' | 'likes' | 'comments' | 'shares' | 'views' | 'engagement_rate';

export interface ChatbotConversation {
  id: number;
  account_id: number;
  user_handle: string;
  message: string;
  response?: string;
  sentiment?: number;
  created_at: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AuthTokenPayload {
  userId: number;
  iat: number;
  exp: number;
}

export interface ChatbotSettings {
  autoReply: boolean;
  responseDelay: number; // seconds
  maxResponsesPerHour: number;
  customPrompt?: string;
}

export interface GrowthMetrics {
  followers: {
    current: number;
    previous: number;
    growth: number;
    growthRate: number;
  };
  engagement: {
    current: number;
    previous: number;
    growth: number;
    growthRate: number;
  };
  posts: {
    current: number;
    previous: number;
    growth: number;
  };
}

export interface AudienceInsights {
  totalFollowers: number;
  engagementRate: number;
  topEngagementHours: number[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topTopics: Array<{
    topic: string;
    mentions: number;
  }>;
}

export interface SchedulingStats {
  totalScheduled: number;
  totalPublished: number;
  totalFailed: number;
  successRate: number;
  upcomingPosts: number;
  platformBreakdown: Record<SocialPlatform, number>;
}