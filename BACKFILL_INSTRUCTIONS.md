# Haremaltin Backfill Instructions

## Problem
Database'de son 24 saat için yeterli hourly data yok (18 point var, 24 olmalı).

## Çözüm: Manuel Backfill

### 1. Haremaltin'den cookies al:
```bash
# 1. https://www.haremaltin.com adresini aç
# 2. DevTools > Network tab > herhangi bir request > Headers
# 3. Cookie header'ını kopyala
```

### 2. Backfill script'ini çalıştır:
```bash
cd /Users/orcunizmirli/projects/valora/valora-api-node

# Tüm instrumentler için 10 yıllık veri
HAREMALTIN_COOKIES="your-cookies-here" npx tsx scripts/backfill-haremaltin.ts
```

### 3. Backend'i restart et:
```bash
# Mevcut process'i durdur
pkill -f "src/server.ts"

# Yeniden başlat
npm run dev
```

## Alternatif: Otomatik biriksin
Backend şu anda her 5 dakikada data çekiyor. 24 saat bekle, veri kendiliğinden birikir.

## Sonuç
Backfill sonrası grafiklerde:
- 1D: ~24 hourly point
- 1W-1Y: Daily close veriler
- 3Y-10Y: Aggregated daily data
