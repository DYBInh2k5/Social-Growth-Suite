#!/bin/bash

# Social Growth Suite Setup Script
echo "🚀 Setting up Social Growth Suite..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker is available"
    
    # Ask if user wants to start with Docker
    read -p "Do you want to start the application with Docker? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Starting with Docker..."
        docker-compose -f docker-compose.dev.yml up -d
        echo "✅ Application started!"
        echo "📊 API: http://localhost:3000"
        echo "🗄️  Database Admin: http://localhost:8080"
        echo "📚 Health Check: http://localhost:3000/health"
    fi
else
    echo "⚠️  Docker not found. You can still run the application manually."
    echo "📚 Check README.md for manual setup instructions"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys and database configuration"
echo "2. Start PostgreSQL and Redis services"
echo "3. Run 'npm run dev' to start development server"
echo ""
echo "📚 Documentation:"
echo "- API Documentation: ./API_DOCUMENTATION.md"
echo "- Deployment Guide: ./DEPLOYMENT_GUIDE.md"
echo "- Contributing: ./CONTRIBUTING.md"