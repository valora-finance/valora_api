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
  '14-ayar-altin': '14ayar',
  'gremse-altin': 'gremse',
  'gumus': 'gumus_gram',
  'besli-altin': 'ata5',
  'gram-platin': 'platin_gram',
  'gram-paladyum': 'paladyum_gram',
};

// Haremaltin instrument code → Our Instrument ID
export const HAREMALTIN_MAPPINGS: Record<string, string> = {
  AYAR14: '14ayar',
  AYAR22: '22ayar',
  ALTIN: 'has',
  ONS: 'ons',
  KULCEALTIN: 'gram',
  CEYREK_YENI: 'ceyrek',
  CEYREK_ESKI: 'ceyrek_eski',
  YARIM_YENI: 'yarim',
  YARIM_ESKI: 'yarim_eski',
  TEK_YENI: 'tam',
  TEK_ESKI: 'tam_eski',
  ATA_YENI: 'ata',
  ATA_ESKI: 'ata_eski',
  ATA5_YENI: 'ata5',
  ATA5_ESKI: 'ata5_eski',
  GREMESE_YENI: 'gremse',
  GREMESE_ESKI: 'gremse_eski',
  GUMUSTRY: 'gumus_gram',
  XAGUSD: 'gumus_ons',
  GUMUSUSD: 'gumus_usd',
  XPTUSD: 'platin_ons',
  XPDUSD: 'paladyum_ons',
  PLATIN: 'platin',
  PALADYUM: 'paladyum',
  USDKG: 'usdkg',
  EURKG: 'eurkg',
  XAUXAG: 'xauxag',
};

// Haremaltin instruments that are NOT covered by Truncgil (need Haremaltin for live data)
export const HAREMALTIN_ONLY_INSTRUMENTS = [
  'CEYREK_ESKI',
  'YARIM_ESKI',
  'TEK_ESKI',
  'ATA_ESKI',
  'ATA5_ESKI',
  'GREMESE_ESKI',
  'GUMUSUSD',
  'XAGUSD',
  'XPTUSD',
  'XPDUSD',
  'PLATIN',
  'PALADYUM',
  'USDKG',
  'EURKG',
  'XAUXAG',
];

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
    // Gold - main
    { id: 'gram', name: 'Gram Altın', code: 'XAU', unit: 'gram', sortOrder: 1 },
    { id: 'has', name: 'Has Altın', code: 'XAU', unit: 'gram', sortOrder: 2 },
    { id: 'ons', name: 'Ons Altın', code: 'XAU', unit: 'ounce', sortOrder: 3 },
    { id: '22ayar', name: '22 Ayar Bilezik', code: 'XAU', unit: 'gram', sortOrder: 4 },
    { id: '14ayar', name: '14 Ayar Altın', code: 'XAU', unit: 'gram', sortOrder: 5 },
    // Gold coins - yeni
    { id: 'ceyrek', name: 'Yeni Çeyrek', code: 'XAU', unit: 'piece', sortOrder: 6 },
    { id: 'yarim', name: 'Yeni Yarım', code: 'XAU', unit: 'piece', sortOrder: 7 },
    { id: 'tam', name: 'Yeni Tam', code: 'XAU', unit: 'piece', sortOrder: 8 },
    { id: 'ata', name: 'Yeni Ata', code: 'XAU', unit: 'piece', sortOrder: 9 },
    { id: 'ata5', name: 'Yeni Ata 5\'li', code: 'XAU', unit: 'piece', sortOrder: 10 },
    { id: 'gremse', name: 'Yeni Gremse', code: 'XAU', unit: 'piece', sortOrder: 11 },
    // Gold coins - eski
    { id: 'ceyrek_eski', name: 'Eski Çeyrek', code: 'XAU', unit: 'piece', sortOrder: 12 },
    { id: 'yarim_eski', name: 'Eski Yarım', code: 'XAU', unit: 'piece', sortOrder: 13 },
    { id: 'tam_eski', name: 'Eski Tam', code: 'XAU', unit: 'piece', sortOrder: 14 },
    { id: 'ata_eski', name: 'Eski Ata', code: 'XAU', unit: 'piece', sortOrder: 15 },
    { id: 'ata5_eski', name: 'Eski Ata 5\'li', code: 'XAU', unit: 'piece', sortOrder: 16 },
    { id: 'gremse_eski', name: 'Eski Gremse', code: 'XAU', unit: 'piece', sortOrder: 17 },
    // Silver
    { id: 'gumus_gram', name: 'Gümüş (Gram)', code: 'XAG', unit: 'gram', sortOrder: 18 },
    { id: 'gumus_ons', name: 'Gümüş (Ons)', code: 'XAG', unit: 'ounce', sortOrder: 19 },
    { id: 'gumus_usd', name: 'Gümüş USD', code: 'XAG', unit: 'gram', sortOrder: 20 },
    // Platinum & Palladium
    { id: 'platin_gram', name: 'Platin (Gram)', code: 'XPT', unit: 'gram', sortOrder: 21 },
    { id: 'platin_ons', name: 'Platin (Ons)', code: 'XPT', unit: 'ounce', sortOrder: 22 },
    { id: 'platin', name: 'Platin TL', code: 'XPT', unit: 'gram', sortOrder: 23 },
    { id: 'paladyum_gram', name: 'Paladyum (Gram)', code: 'XPD', unit: 'gram', sortOrder: 24 },
    { id: 'paladyum_ons', name: 'Paladyum (Ons)', code: 'XPD', unit: 'ounce', sortOrder: 25 },
    { id: 'paladyum', name: 'Paladyum TL', code: 'XPD', unit: 'gram', sortOrder: 26 },
    // International gold
    { id: 'usdkg', name: 'USD/KG Altın', code: 'XAU', unit: 'kg', sortOrder: 27 },
    { id: 'eurkg', name: 'EUR/KG Altın', code: 'XAU', unit: 'kg', sortOrder: 28 },
    // Ratios
    { id: 'xauxag', name: 'Altın/Gümüş Oranı', code: 'XAUXAG', unit: 'ratio', sortOrder: 29 },
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
