import { describe, it, expect, beforeEach } from 'vitest';
import { TcmbService } from './tcmb.service';

describe('TcmbService', () => {
  let service: TcmbService;

  beforeEach(() => {
    service = new TcmbService();
  });

  describe('parseXml', () => {
    it('should parse TCMB XML response correctly', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>35.1234</ForexBuying>
    <ForexSelling>35.2345</ForexSelling>
    <BanknoteBuying>35.0000</BanknoteBuying>
    <BanknoteSelling>35.3000</BanknoteSelling>
  </Currency>
  <Currency CurrencyCode="EUR" Kod="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <CurrencyName>EURO</CurrencyName>
    <ForexBuying>38.5000</ForexBuying>
    <ForexSelling>38.6500</ForexSelling>
    <BanknoteBuying>38.4000</BanknoteBuying>
    <BanknoteSelling>38.7500</BanknoteSelling>
  </Currency>
  <Currency CurrencyCode="GBP" Kod="GBP">
    <Unit>1</Unit>
    <Isim>İNGİLİZ STERLİNİ</Isim>
    <CurrencyName>POUND STERLING</CurrencyName>
    <ForexBuying>44.2000</ForexBuying>
    <ForexSelling>44.3500</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);

      expect(quotes.length).toBeGreaterThanOrEqual(3);

      // Check USD mapping
      const usdQuote = quotes.find((q) => q.instrumentId === 'USDTRY');
      expect(usdQuote).toBeDefined();
      expect(usdQuote?.buy).toBe(35.1234);
      expect(usdQuote?.sell).toBe(35.2345);
      expect(usdQuote?.price).toBe((35.1234 + 35.2345) / 2);
      expect(usdQuote?.source).toBe('tcmb');

      // Check EUR mapping
      const eurQuote = quotes.find((q) => q.instrumentId === 'EURTRY');
      expect(eurQuote).toBeDefined();
      expect(eurQuote?.buy).toBe(38.5);
      expect(eurQuote?.sell).toBe(38.65);

      // Check GBP mapping
      const gbpQuote = quotes.find((q) => q.instrumentId === 'GBPTRY');
      expect(gbpQuote).toBeDefined();
    });

    it('should calculate EURUSD from EUR and USD rates', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>35.0000</ForexBuying>
    <ForexSelling>35.2000</ForexSelling>
  </Currency>
  <Currency CurrencyCode="EUR" Kod="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <CurrencyName>EURO</CurrencyName>
    <ForexBuying>38.5000</ForexBuying>
    <ForexSelling>38.5000</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);

      const eurUsdQuote = quotes.find((q) => q.instrumentId === 'EURUSD');
      expect(eurUsdQuote).toBeDefined();

      // EURUSD = EUR / USD
      const eurPrice = 38.5;
      const usdPrice = (35.0 + 35.2) / 2;
      const expectedEurUsd = eurPrice / usdPrice;

      expect(eurUsdQuote?.price).toBeCloseTo(expectedEurUsd, 4);
      expect(eurUsdQuote?.source).toBe('tcmb_calculated');
    });

    it('should handle missing currencies gracefully', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>35.1234</ForexBuying>
    <ForexSelling>35.2345</ForexSelling>
  </Currency>
  <Currency CurrencyCode="GBP" Kod="GBP">
    <Unit>1</Unit>
    <Isim>STERLIN</Isim>
    <CurrencyName>POUND</CurrencyName>
    <ForexBuying>44.00</ForexBuying>
    <ForexSelling>44.20</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);

      // Should have at least USD and GBP
      expect(quotes.length).toBeGreaterThanOrEqual(2);
      const usdQuote = quotes.find((q) => q.instrumentId === 'USDTRY');
      expect(usdQuote).toBeDefined();

      // EURUSD should not be calculated without EUR
      const eurUsdQuote = quotes.find((q) => q.instrumentId === 'EURUSD');
      expect(eurUsdQuote).toBeUndefined();
    });

    it('should include timestamps', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <ForexBuying>35.0000</ForexBuying>
    <ForexSelling>35.2000</ForexSelling>
  </Currency>
  <Currency CurrencyCode="EUR" Kod="EUR">
    <Unit>1</Unit>
    <ForexBuying>38.0000</ForexBuying>
    <ForexSelling>38.2000</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);
      const now = Math.floor(Date.now() / 1000);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].ts).toBeGreaterThan(now - 60); // Within last minute
      expect(quotes[0].ts).toBeLessThanOrEqual(now);
    });

    it('should handle zero or missing buy/sell values', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <ForexBuying></ForexBuying>
    <ForexSelling>35.2000</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);

      const usdQuote = quotes.find((q) => q.instrumentId === 'USDTRY');
      if (usdQuote) {
        // Should handle gracefully - either skip or set to null
        expect(usdQuote.buy === null || usdQuote.buy === 0).toBe(true);
      }
    });
  });

  describe('instrument mappings', () => {
    it('should map all required forex instruments', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="08.02.2026" Date="02/08/2026" Bulten_No="2026/026">
  <Currency CurrencyCode="USD" Kod="USD">
    <Unit>1</Unit>
    <ForexBuying>35.00</ForexBuying>
    <ForexSelling>35.20</ForexSelling>
  </Currency>
  <Currency CurrencyCode="EUR" Kod="EUR">
    <Unit>1</Unit>
    <ForexBuying>38.50</ForexBuying>
    <ForexSelling>38.65</ForexSelling>
  </Currency>
  <Currency CurrencyCode="GBP" Kod="GBP">
    <Unit>1</Unit>
    <ForexBuying>44.20</ForexBuying>
    <ForexSelling>44.35</ForexSelling>
  </Currency>
  <Currency CurrencyCode="CHF" Kod="CHF">
    <Unit>1</Unit>
    <ForexBuying>39.50</ForexBuying>
    <ForexSelling>39.65</ForexSelling>
  </Currency>
  <Currency CurrencyCode="AUD" Kod="AUD">
    <Unit>1</Unit>
    <ForexBuying>23.00</ForexBuying>
    <ForexSelling>23.15</ForexSelling>
  </Currency>
  <Currency CurrencyCode="CAD" Kod="CAD">
    <Unit>1</Unit>
    <ForexBuying>25.50</ForexBuying>
    <ForexSelling>25.65</ForexSelling>
  </Currency>
  <Currency CurrencyCode="SAR" Kod="SAR">
    <Unit>1</Unit>
    <ForexBuying>9.30</ForexBuying>
    <ForexSelling>9.40</ForexSelling>
  </Currency>
  <Currency CurrencyCode="JPY" Kod="JPY">
    <Unit>100</Unit>
    <ForexBuying>23.50</ForexBuying>
    <ForexSelling>23.65</ForexSelling>
  </Currency>
</Tarih_Date>`;

      const quotes = (service as any).parseXml(mockXml);

      const expectedInstruments = [
        'USDTRY',
        'EURTRY',
        'GBPTRY',
        'CHFTRY',
        'AUDTRY',
        'CADTRY',
        'SARTRY',
        'JPYTRY',
        'EURUSD', // calculated
      ];

      expectedInstruments.forEach((instrumentId) => {
        const quote = quotes.find((q) => q.instrumentId === instrumentId);
        expect(quote, `Expected to find ${instrumentId}`).toBeDefined();
      });
    });
  });
});
