#!/bin/bash
set -e

echo "🚂 Valora API - Railway Deployment"
echo "=================================="

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Railway'e giriş yapmadınız. Lütfen önce 'railway login' yapın."
    exit 1
fi

echo "✅ Railway'e giriş yapılmış"

# Set environment variables
echo "🔧 Environment variables ayarlanıyor..."
railway variables set NODE_ENV=production
railway variables set API_KEY=vla_$(openssl rand -hex 16)

echo "📦 PostgreSQL DATABASE_URL otomatik olarak Railway tarafından ayarlanacak"

# Run migrations
echo "🗄️  Database migrations çalıştırılıyor..."
railway run npm run db:migrate

# Seed database
echo "🌱 Database seed..."
railway run npm run db:seed

# Deploy
echo "🚀 Deployment başlatılıyor..."
railway up

echo ""
echo "✅ Deployment tamamlandı!"
echo ""
echo "📊 Logs görmek için: railway logs"
echo "🌐 URL görmek için: railway domain"
echo ""
