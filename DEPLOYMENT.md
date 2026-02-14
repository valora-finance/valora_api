# Railway Deployment Guide

## Hızlı Başlangıç

### 1. Railway'e Giriş Yap
```bash
railway login
```
Tarayıcı açılacak, GitHub hesabınla giriş yap.

### 2. Proje Oluştur ve Deploy Et
```bash
# Otomatik deployment script
./deploy-railway.sh
```

**VEYA Manuel Olarak:**

```bash
# Railway projesi oluştur
railway init

# PostgreSQL ekle
railway add --plugin postgresql

# Environment variables
railway variables set NODE_ENV=production
railway variables set API_KEY=vla_$(openssl rand -hex 16)

# Database setup
railway run npm run db:migrate
railway run npm run db:seed

# Deploy!
railway up
```

### 3. Domain Ayarla
```bash
# Railway domain al
railway domain

# Custom domain ekle (opsiyonel)
railway domain add api.valora.com
```

### 4. URL'i Öğren
```bash
railway status
```

## Post-Deployment

### Logs İzle
```bash
railway logs --tail
```

### Environment Variables Kontrol
```bash
railway variables
```

### Database Bağlantısı Test
```bash
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM instruments;"
```

### Health Check
```bash
curl https://your-app.railway.app/health
```

## Production Checklist

- [ ] API_KEY güvenli bir şekilde oluşturuldu
- [ ] DATABASE_URL Railway tarafından otomatik set edildi
- [ ] Migrations başarıyla çalıştı
- [ ] Seed başarıyla çalıştı
- [ ] Health endpoint çalışıyor
- [ ] /v1/metals/latest endpoint çalışıyor
- [ ] /v1/fx/latest endpoint çalışıyor
- [ ] Logs temiz (error yok)
- [ ] Background scheduler çalışıyor (logları kontrol et)

## Troubleshooting

### Migration Hatası
```bash
railway run npm run db:migrate
```

### Seed Hatası
```bash
railway run npm run db:seed
```

### Logs Kontrol
```bash
railway logs --tail
```

### Environment Variables Eksik
```bash
railway variables set API_KEY=your_key_here
```

### Database Reset (DİKKAT: Tüm veri silinir!)
```bash
railway run psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
railway run npm run db:migrate
railway run npm run db:seed
```

## Monitoring

### Uptime Monitoring
Railway otomatik health check yapar (`/health` endpoint).

### Logs
```bash
# Son 100 log
railway logs --tail

# Tüm logs
railway logs
```

### Metrics
Railway dashboard'da CPU, Memory, Network kullanımını görebilirsin.

## Cost

Railway free tier:
- $5 ücretsiz kredi (aylık)
- Genellikle bu API için yeterli
- Aşarsan sadece kullandığın kadar ödeme yaparsın

## Mobil App Integration

Deployment tamamlandıktan sonra mobil uygulamada:

```typescript
// valora-mobile/src/config/api.ts
export const API_BASE_URL = 'https://valora-api-production.up.railway.app';
export const API_KEY = 'vla_...'; // Railway'den aldığın API key
```

## Next Steps

1. ✅ Railway'e deploy et
2. ✅ Mobil uygulamayı yeni API'ye bağla
3. ✅ Production'da test et
4. ✅ Custom domain ekle (opsiyonel)
5. ✅ Monitoring ekle (Better Uptime, Sentry)

