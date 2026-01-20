@echo off
echo 🚀 Setting up Social Growth Suite...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Copy environment file
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your configuration
) else (
    echo ✅ .env file already exists
)

REM Build the project
echo 🔨 Building project...
npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo ✅ Build successful!

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 🐳 Docker is available
    
    set /p choice="Do you want to start the application with Docker? (y/n): "
    if /i "%choice%"=="y" (
        echo 🚀 Starting with Docker...
        docker-compose -f docker-compose.dev.yml up -d
        echo ✅ Application started!
        echo 📊 API: http://localhost:3000
        echo 🗄️  Database Admin: http://localhost:8080
        echo 📚 Health Check: http://localhost:3000/health
    )
) else (
    echo ⚠️  Docker not found. You can still run the application manually.
    echo 📚 Check README.md for manual setup instructions
)

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Edit .env file with your API keys and database configuration
echo 2. Start PostgreSQL and Redis services
echo 3. Run 'npm run dev' to start development server
echo.
echo 📚 Documentation:
echo - API Documentation: ./API_DOCUMENTATION.md
echo - Deployment Guide: ./DEPLOYMENT_GUIDE.md
echo - Contributing: ./CONTRIBUTING.md

pause