# Valora Project Rules

## Veri Kaynakları

**Kesinlikle her zaman gerçek piyasa verisi kullanılmalıdır.**

- Fiyat verilerini asla hesaplama (oran × başka enstrüman) veya tahminiyle türetme
- Mock, dummy veya yaklaşık (approximated) veri asla DB'ye yazılmaz
- Her enstrümanın kendi gerçek alış/satış fiyatı olmalı (gerçek bir kaynaktan)
- Geçmiş (historical) veri için de gerçek kaynak zorunludur — gram'dan türetme, interpolasyon vb. kabul edilmez

### Mevcut Gerçek Veri Kaynakları

| Kaynak | Ne için | Not |
|--------|---------|-----|
| Truncgil (`finans.truncgil.com/today.json`) | Anlık metal fiyatları | Her 5 dakikada refresh |
| TCMB (`tcmb.gov.tr/kurlar`) | Anlık + geçmiş döviz kurları | Hafta sonu yok |
| ExchangeRate.host | TCMB yedek kaynağı | Fallback |
| Haremaltin.com (`/ajax/cur/history`) | Geçmiş metal fiyatları | cf_clearance cookie gerektirir |

### Haremaltin.com Geçmiş Veri

POST parametreleri:
```
kod=AYAR14        # Enstrüman kodu (AYAR14, AYAR22 vb.)
dil_kodu=tr
tarih1=2021-02-22 00:00:00   # Başlangıç
tarih2=2026-02-22 00:00:00   # Bitiş
```

Cloudflare koruması nedeniyle `HAREMALTIN_CF_CLEARANCE` env değişkeni gerekir.
Chrome → DevTools → Application → Cookies → `cf_clearance` değeri.

## Proje Yapısı

- **Backend:** `valora-api-node/` — Node.js + Fastify + Drizzle ORM + Neon PostgreSQL
- **Mobile:** `valora-mobile/` — React Native + Expo
- **Deploy:** Render (backend), GitHub (kaynak)

## Git Kuralları

- Tüm commit mesajları Türkçe yazılmalıdır. Commit description'ında yapılan değişiklikler Türkçe açıklanmalıdır.
