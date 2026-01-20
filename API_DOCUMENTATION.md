# Social Growth Suite - API Documentation

## 🚀 Overview

Social Growth Suite API cung cấp các endpoint để quản lý tài khoản social media, lên lịch đăng bài, phân tích dữ liệu, chatbot AI và tạo nội dung tự động.

**Base URL**: `http://localhost:3000/api`

## 🔐 Authentication

Tất cả các endpoint (trừ register/login) yêu cầu JWT token trong header:

```
Authorization: Bearer <your_jwt_token>
```

## 📊 Rate Limiting

- **API General**: 100 requests/15 phút
- **Authentication**: 5 attempts/15 phút  
- **Chatbot**: 10 requests/phút
- **Content Generation**: 20 requests/giờ
- **Scheduling**: 50 operations/giờ

## 🔑 Authentication Endpoints

### POST /auth/register
Đăng ký tài khoản mới

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Tên người dùng"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Tên người dùng"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Đăng nhập

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### GET /auth/me
Lấy thông tin user hiện tại

### PUT /auth/profile
Cập nhật thông tin profile

### PUT /auth/password
Đổi mật khẩu

## 📱 Social Accounts Management

### GET /accounts
Lấy danh sách tài khoản social media

**Response:**
```json
{
  "accounts": [
    {
      "id": 1,
      "platform": "twitter",
      "account_name": "@username",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /accounts
Thêm tài khoản social media mới

**Request Body:**
```json
{
  "platform": "twitter",
  "accountName": "@username",
  "accessToken": "token",
  "refreshToken": "refresh_token",
  "accountData": {
    "user_id": "123456789"
  }
}
```

### PUT /accounts/:accountId
Cập nhật tài khoản

### DELETE /accounts/:accountId
Xóa tài khoản

### GET /accounts/:accountId/analytics
Lấy analytics của tài khoản

### POST /accounts/:accountId/test
Test kết nối tài khoản

## 📈 Analytics Endpoints

### GET /analytics/dashboard
Dashboard tổng quan

**Query Parameters:**
- `days` (optional): Số ngày phân tích (default: 30)

**Response:**
```json
{
  "summary": {
    "totalFollowers": 1500,
    "totalPosts": 45,
    "totalEngagement": 2300
  },
  "accounts": [...],
  "trends": {...}
}
```

### GET /analytics/growth
Phân tích tăng trưởng

**Query Parameters:**
- `days` (optional): Số ngày
- `accountId` (optional): ID tài khoản cụ thể

### GET /analytics/audience
Phân tích audience

**Query Parameters:**
- `accountId` (required): ID tài khoản

### GET /analytics/compare
So sánh hiệu suất các platform

## 🤖 Chatbot Endpoints

### POST /chatbot/message
Xử lý tin nhắn đến (webhook)

**Request Body:**
```json
{
  "accountId": 1,
  "userHandle": "@user123",
  "message": "Hello, I need help",
  "platform": "twitter"
}
```

**Response:**
```json
{
  "success": true,
  "shouldReply": true,
  "response": "Hi! How can I help you today?",
  "sentiment": 0.8
}
```

### GET /chatbot/conversations/:accountId
Lịch sử hội thoại

**Query Parameters:**
- `page` (optional): Trang (default: 1)
- `limit` (optional): Số lượng/trang (default: 20)

### GET /chatbot/stats/:accountId
Thống kê chatbot

**Query Parameters:**
- `days` (optional): Số ngày (default: 7)

### GET /chatbot/settings/:accountId
Lấy cài đặt chatbot

### PUT /chatbot/settings/:accountId
Cập nhật cài đặt chatbot

**Request Body:**
```json
{
  "autoReply": true,
  "responseDelay": 30,
  "maxResponsesPerHour": 10,
  "customPrompt": "Custom instructions..."
}
```

## ⏰ Scheduler Endpoints

### GET /scheduler
Lấy danh sách bài đã lên lịch

**Query Parameters:**
- `status` (optional): pending/published/failed/all
- `page`, `limit`: Phân trang

### POST /scheduler
Lên lịch bài viết mới

**Request Body:**
```json
{
  "accountId": 1,
  "content": "Nội dung bài viết",
  "mediaUrls": ["https://example.com/image.jpg"],
  "scheduledTime": "2024-12-25T10:00:00Z"
}
```

### PUT /scheduler/:postId
Cập nhật bài đã lên lịch

### DELETE /scheduler/:postId
Xóa bài đã lên lịch

### POST /scheduler/bulk
Lên lịch nhiều bài cùng lúc

**Request Body:**
```json
{
  "posts": [
    {
      "accountId": 1,
      "content": "Post 1",
      "scheduledTime": "2024-12-25T10:00:00Z"
    },
    {
      "accountId": 1,
      "content": "Post 2", 
      "scheduledTime": "2024-12-25T14:00:00Z"
    }
  ]
}
```

### GET /scheduler/stats/overview
Thống kê scheduling

## 📝 Content Generation Endpoints

### POST /content/suggestions
Tạo gợi ý nội dung

**Request Body:**
```json
{
  "platform": "twitter",
  "category": "technology",
  "count": 5
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "title": "AI Tips",
      "content": "🤖 5 cách AI có thể giúp tăng productivity...",
      "hashtags": ["#AI", "#productivity", "#tech"],
      "bestTime": "14:00",
      "platform": "twitter",
      "category": "technology"
    }
  ]
}
```

### GET /content/trending/:platform
Lấy trending topics

### GET /content/performance/:accountId
Phân tích hiệu suất nội dung

### POST /content/hashtags
Tạo gợi ý hashtag

**Request Body:**
```json
{
  "content": "Nội dung bài viết...",
  "platform": "instagram"
}
```

### GET /content/calendar
Lịch nội dung

**Query Parameters:**
- `startDate`, `endDate` (required): Khoảng thời gian
- `platform` (optional): Platform cụ thể

### GET /content/insights
Insights về nội dung

### POST /content/templates
Lưu template nội dung

### GET /content/templates
Lấy danh sách templates

### POST /content/templates/:templateId/use
Sử dụng template

## 🔔 Notifications Endpoints

### GET /notifications
Lấy danh sách thông báo

**Query Parameters:**
- `page`, `limit`: Phân trang
- `unreadOnly`: true/false

### GET /notifications/unread-count
Số lượng thông báo chưa đọc

### PUT /notifications/mark-read
Đánh dấu đã đọc

**Request Body:**
```json
{
  "notificationIds": [1, 2, 3]
}
```

### PUT /notifications/mark-all-read
Đánh dấu tất cả đã đọc

### GET /notifications/rules
Lấy cài đặt thông báo

### PUT /notifications/rules
Cập nhật cài đặt thông báo

**Request Body:**
```json
{
  "rules": [
    {
      "type": "post_published",
      "enabled": true
    },
    {
      "type": "high_engagement", 
      "enabled": true,
      "conditions": { "threshold": 50 }
    }
  ]
}
```

### GET /notifications/realtime
Lấy thông báo real-time

### POST /notifications/test
Tạo thông báo test (development)

## 📊 Response Format

### Success Response
```json
{
  "data": {...},
  "message": "Success message"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": ["Validation error 1", "Validation error 2"]
}
```

### Pagination Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🚨 Error Codes

- **400**: Bad Request - Dữ liệu không hợp lệ
- **401**: Unauthorized - Chưa đăng nhập hoặc token không hợp lệ
- **403**: Forbidden - Không có quyền truy cập
- **404**: Not Found - Không tìm thấy resource
- **409**: Conflict - Dữ liệu đã tồn tại
- **429**: Too Many Requests - Vượt quá rate limit
- **500**: Internal Server Error - Lỗi server

## 🔧 Development & Testing

### Health Check
```
GET /health
```

### Environment Variables Required
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret
OPENAI_API_KEY=your-openai-key
TWITTER_API_KEY=your-twitter-key
FACEBOOK_APP_ID=your-facebook-id
```

### Webhook Setup

Để nhận tin nhắn từ social platforms, cần setup webhook endpoints:

**Twitter**: POST /api/chatbot/message
**Facebook**: POST /api/chatbot/message  
**Instagram**: POST /api/chatbot/message

## 📱 Platform-Specific Notes

### Twitter/X
- Content limit: 280 characters
- Media: 4 images max
- Rate limits: 300 tweets/3 hours

### Facebook
- Content limit: 63,206 characters
- Media: Multiple images/videos
- Requires page access token

### Instagram
- Content limit: 2,200 characters
- Media: Required for posts
- Hashtag limit: 30

### LinkedIn
- Content limit: 3,000 characters
- Professional content focus
- Company page vs personal profile

## 🔒 Security Best Practices

1. **Always use HTTPS** trong production
2. **Validate input** - Tất cả input đều được validate
3. **Rate limiting** - Tránh abuse
4. **Token expiry** - JWT tokens có thời hạn
5. **Audit logging** - Log các hành động quan trọng
6. **Data encryption** - Sensitive data được mã hóa

## 📞 Support

Để được hỗ trợ:
1. Check API documentation
2. Xem error logs
3. Test với Postman collection
4. Contact support team