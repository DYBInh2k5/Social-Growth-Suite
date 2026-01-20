# Contributing to Social Growth Suite

Chúng tôi rất hoan nghênh các đóng góp cho Social Growth Suite! 🎉

## 🚀 Cách đóng góp

### 1. Fork Repository
- Fork repository này về GitHub account của bạn
- Clone fork về máy local

### 2. Setup Development Environment
```bash
# Clone repository
git clone https://github.com/your-username/Social-Growth-Suite.git
cd Social-Growth-Suite

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Cấu hình các biến môi trường cần thiết

# Build project
npm run build

# Run development server
npm run dev
```

### 3. Development Guidelines

#### Code Style
- Sử dụng TypeScript cho tất cả code mới
- Follow ESLint và Prettier configuration
- Viết code comments bằng tiếng Việt hoặc tiếng Anh
- Sử dụng meaningful variable và function names

#### Commit Messages
Sử dụng conventional commit format:
```
type(scope): description

feat(auth): add JWT authentication
fix(database): resolve connection timeout issue
docs(readme): update installation guide
style(ui): improve button styling
refactor(api): optimize database queries
test(auth): add unit tests for login
```

#### Branch Naming
- `feature/feature-name` - Tính năng mới
- `fix/bug-description` - Sửa lỗi
- `docs/documentation-update` - Cập nhật documentation
- `refactor/code-improvement` - Refactor code

### 4. Pull Request Process

1. **Tạo branch mới** từ `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement changes**
   - Viết code clean và có comment
   - Add tests nếu cần thiết
   - Update documentation

3. **Test thoroughly**
   ```bash
   npm run build
   npm run test
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "feat(feature): add new feature description"
   ```

5. **Push và tạo PR**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Tạo Pull Request** trên GitHub với:
   - Mô tả chi tiết về changes
   - Screenshots nếu có UI changes
   - Link đến related issues

### 5. Code Review Process

- Tất cả PR cần ít nhất 1 review
- Address tất cả feedback trước khi merge
- Maintainers sẽ review trong vòng 48h

## 🐛 Bug Reports

Khi report bug, vui lòng include:

- **Environment**: OS, Node.js version, npm version
- **Steps to reproduce**: Chi tiết các bước
- **Expected behavior**: Kết quả mong đợi
- **Actual behavior**: Kết quả thực tế
- **Screenshots**: Nếu có UI issues
- **Error logs**: Console errors hoặc server logs

## 💡 Feature Requests

Khi suggest tính năng mới:

- **Use case**: Tại sao cần tính năng này?
- **Proposed solution**: Ý tưởng implementation
- **Alternatives**: Các giải pháp khác đã consider
- **Additional context**: Screenshots, mockups, etc.

## 📋 Development Tasks

### Priority Areas
- [ ] Frontend development (React/Vue dashboard)
- [ ] Mobile app (React Native/Flutter)
- [ ] Additional social platforms (TikTok, YouTube)
- [ ] Advanced AI features
- [ ] Performance optimization
- [ ] Security enhancements
- [ ] Documentation improvements

### Good First Issues
- Documentation updates
- UI/UX improvements
- Bug fixes
- Test coverage
- Code refactoring

## 🔧 Technical Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI**: OpenAI GPT
- **Automation**: Puppeteer
- **Deployment**: Docker, Docker Compose

## 📚 Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Project Structure](./README.md#project-structure)

## 🤝 Community

- **GitHub Issues**: Bug reports và feature requests
- **Discussions**: General questions và ideas
- **Discord**: Real-time chat (coming soon)

## 📄 License

Bằng cách contribute, bạn đồng ý rằng contributions sẽ được licensed under MIT License.

---

Cảm ơn bạn đã quan tâm đến việc contribute cho Social Growth Suite! 🚀