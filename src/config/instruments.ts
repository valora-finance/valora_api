// Instrument mappings between external APIs and our internal IDs

export const METAL_MAPPINGS: Record<string, string> = {
  // Truncgil API key → Our Instrument ID
  'gram-altin': 'gram',
  'ceyrek-altin': 'ceyrek',
  'ons': 'ons',
  'yarim-altin': 'yarim',
  'tam-altin': 'tam',
  'ata-altin': 'ata',
  'gram-has-altin': 'has',
  '22-ayar-bilezik': '22ayar',
  'gremse-altin': 'gremse',
  'gumus': 'gumus_gram',
  // gumus_ons will be calculated: gumus * 28.35
};

export const FOREX_MAPPINGS: Record<string, string> = {
  // TCMB Currency Code → Our Instrument ID
  'USD': 'USDTRY',
  'EUR': 'EURTRY',
  'GBP': 'GBPTRY',
  'CHF': 'CHFTRY',
  'AUD': 'AUDTRY',
  'CAD': 'CADTRY',
  'SAR': 'SARTRY',
  'JPY': 'JPYTRY',
  // EURUSD will be calculated: EUR / USD
};

// Instrument definitions for seeding
export const INSTRUMENTS = {
  metals: [
    { id: 'gram', name: 'Gram Altın', code: 'XAU', unit: 'gram', sortOrder: 1 },
    { id: 'ceyrek', name: 'Çeyrek Altın', code: 'XAU', unit: 'piece', sortOrder: 2 },
    { id: 'ons', name: 'Ons Altın', code: 'XAU', unit: 'ounce', sortOrder: 3 },
    { id: 'yarim', name: 'Yarım Altın', code: 'XAU', unit: 'piece', sortOrder: 4 },
    { id: 'tam', name: 'Tam Altın', code: 'XAU', unit: 'piece', sortOrder: 5 },
    { id: 'ata', name: 'Ata Lira', code: 'XAU', unit: 'piece', sortOrder: 6 },
    { id: 'has', name: 'Has Altın', code: 'XAU', unit: 'gram', sortOrder: 7 },
    { id: '22ayar', name: '22 Ayar Bilezik', code: 'XAU', unit: 'gram', sortOrder: 8 },
    { id: '14ayar', name: '14 Ayar Altın', code: 'XAU', unit: 'gram', sortOrder: 9 },
    { id: 'gremse', name: 'Gremse', code: 'XAU', unit: 'piece', sortOrder: 10 },
    { id: 'gumus_gram', name: 'Gümüş (Gram)', code: 'XAG', unit: 'gram', sortOrder: 11 },
    { id: 'gumus_ons', name: 'Gümüş (Ons)', code: 'XAG', unit: 'ounce', sortOrder: 12 },
  ],
  fx: [
    { id: 'USDTRY', name: 'USD/TRY', code: 'USD', sortOrder: 1 },
    { id: 'EURTRY', name: 'EUR/TRY', code: 'EUR', sortOrder: 2 },
    { id: 'EURUSD', name: 'EUR/USD', code: 'EUR', sortOrder: 3 },
    { id: 'GBPTRY', name: 'GBP/TRY', code: 'GBP', sortOrder: 4 },
    { id: 'CHFTRY', name: 'CHF/TRY', code: 'CHF', sortOrder: 5 },
    { id: 'AUDTRY', name: 'AUD/TRY', code: 'AUD', sortOrder: 6 },
    { id: 'CADTRY', name: 'CAD/TRY', code: 'CAD', sortOrder: 7 },
    { id: 'SARTRY', name: 'SAR/TRY', code: 'SAR', sortOrder: 8 },
    { id: 'JPYTRY', name: 'JPY/TRY', code: 'JPY', sortOrder: 9 },
  ],
};
