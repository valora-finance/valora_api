import { describe, it, expect, beforeEach } from 'vitest';
import { TruncgilService } from './truncgil.service';

describe('TruncgilService', () => {
  let service: TruncgilService;

  beforeEach(() => {
    service = new TruncgilService();
  });

  describe('parsePrice', () => {
    it('should parse Turkish decimal format correctly', () => {
      expect(service.parsePrice('6.942,61')).toBe(6942.61);
      expect(service.parsePrice('1.234,56')).toBe(1234.56);
      expect(service.parsePrice('123,45')).toBe(123.45);
      expect(service.parsePrice('12.345,67')).toBe(12345.67);
    });

    it('should handle prices without thousands separator', () => {
      expect(service.parsePrice('942,61')).toBe(942.61);
      expect(service.parsePrice('42,61')).toBe(42.61);
    });

    it('should handle edge cases', () => {
      expect(service.parsePrice('0,00')).toBe(0);
      expect(service.parsePrice('1,00')).toBe(1.0);
    });
  });

  describe('parseToQuotes', () => {
    it('should parse complete Truncgil response', () => {
      const mockData = {
        Update_Date: '10.02.2024 15:30:00',
        'gram-altin': {
          Alış: '2.550,00',
          Satış: '2.555,00',
        },
        'ceyrek-altin': {
          Alış: '4.200,00',
          Satış: '4.210,00',
        },
        ons: {
          Alış: '79.350,00',
          Satış: '79.450,00',
        },
        gumus: {
          Alış: '28,50',
          Satış: '29,00',
        },
      };

      const quotes = service.parseToQuotes(mockData);

      // Should have 4 direct mappings + 1 calculated (gumus_ons)
      expect(quotes.length).toBeGreaterThanOrEqual(4);

      // Check gram-altin mapping
      const gramQuote = quotes.find((q) => q.instrumentId === 'gram');
      expect(gramQuote).toBeDefined();
      expect(gramQuote?.buy).toBe(2550.0);
      expect(gramQuote?.sell).toBe(2555.0);
      expect(gramQuote?.price).toBe(2552.5); // Average
      expect(gramQuote?.source).toBe('truncgil');

      // Check gumus_gram mapping
      const gumusGramQuote = quotes.find((q) => q.instrumentId === 'gumus_gram');
      expect(gumusGramQuote).toBeDefined();
      expect(gumusGramQuote?.buy).toBe(28.5);
      expect(gumusGramQuote?.sell).toBe(29.0);

      // Check gumus_ons calculated value (gumus * 28.35)
      const gumusOnsQuote = quotes.find((q) => q.instrumentId === 'gumus_ons');
      expect(gumusOnsQuote).toBeDefined();
      expect(gumusOnsQuote?.price).toBeCloseTo(28.75 * 28.35, 1);
      expect(gumusOnsQuote?.source).toBe('truncgil_calculated');
    });

    it('should handle missing instruments gracefully', () => {
      const mockData = {
        Update_Date: '10.02.2024 15:30:00',
        'gram-altin': {
          Alış: '2.550,00',
          Satış: '2.555,00',
        },
        // Missing other instruments
      };

      const quotes = service.parseToQuotes(mockData);

      expect(quotes.length).toBeGreaterThanOrEqual(1);
      expect(quotes[0].instrumentId).toBe('gram');
    });

    it('should include timestamps', () => {
      const mockData = {
        Update_Date: '10.02.2024 15:30:00',
        'gram-altin': {
          Alış: '2.550,00',
          Satış: '2.555,00',
        },
      };

      const quotes = service.parseToQuotes(mockData);
      const now = Math.floor(Date.now() / 1000);

      expect(quotes[0].ts).toBeGreaterThan(now - 60); // Within last minute
      expect(quotes[0].ts).toBeLessThanOrEqual(now);
    });

    it('should handle invalid price formats', () => {
      const mockData = {
        Update_Date: '10.02.2024 15:30:00',
        'gram-altin': {
          Alış: 'invalid',
          Satış: '2.555,00',
        },
      };

      const quotes = service.parseToQuotes(mockData);

      // Should skip invalid entries or handle gracefully
      const gramQuote = quotes.find((q) => q.instrumentId === 'gram');
      if (gramQuote) {
        expect(gramQuote.buy).toBeNaN();
      }
    });
  });

  describe('instrument mappings', () => {
    it('should map all required metal instruments', () => {
      const mockData = {
        Update_Date: '10.02.2024 15:30:00',
        'gram-altin': { Alış: '2.550,00', Satış: '2.555,00' },
        'ceyrek-altin': { Alış: '4.200,00', Satış: '4.210,00' },
        ons: { Alış: '79.350,00', Satış: '79.450,00' },
        'yarim-altin': { Alış: '8.400,00', Satış: '8.420,00' },
        'tam-altin': { Alış: '16.800,00', Satış: '16.840,00' },
        'ata-altin': { Alış: '20.000,00', Satış: '20.050,00' },
        'gram-has-altin': { Alış: '2.600,00', Satış: '2.605,00' },
        '22-ayar-bilezik': { Alış: '2.400,00', Satış: '2.405,00' },
        'gremse-altin': { Alış: '3.000,00', Satış: '3.010,00' },
        gumus: { Alış: '28,50', Satış: '29,00' },
      };

      const quotes = service.parseToQuotes(mockData);

      const expectedInstruments = [
        'gram',
        'ceyrek',
        'ons',
        'yarim',
        'tam',
        'ata',
        'has',
        '22ayar',
        'gremse',
        'gumus_gram',
        'gumus_ons', // calculated
      ];

      expectedInstruments.forEach((instrumentId) => {
        const quote = quotes.find((q) => q.instrumentId === instrumentId);
        expect(quote, `Expected to find ${instrumentId}`).toBeDefined();
      });
    });
  });
});
