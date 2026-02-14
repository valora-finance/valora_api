import { db } from '../src/config/database';
import { instruments } from '../src/db/schema';
import { logger } from '../src/utils/logger';

const metalInstruments = [
  { id: 'gram', name: 'Gram Altın', code: 'XAU/TRY', category: 'metals' as const, sortOrder: 1, unit: 'gram' },
  { id: 'ceyrek', name: 'Çeyrek Altın', code: 'CEYREK', category: 'metals' as const, sortOrder: 2, unit: 'piece' },
  { id: 'ons', name: 'Ons Altın', code: 'XAU/USD', category: 'metals' as const, sortOrder: 3, unit: 'oz' },
  { id: 'yarim', name: 'Yarım Altın', code: 'YARIM', category: 'metals' as const, sortOrder: 4, unit: 'piece' },
  { id: 'tam', name: 'Tam Altın', code: 'TAM', category: 'metals' as const, sortOrder: 5, unit: 'piece' },
  { id: 'ata', name: 'Ata Lira', code: 'ATA', category: 'metals' as const, sortOrder: 6, unit: 'piece' },
  { id: 'has', name: 'Has Altın', code: 'HAS', category: 'metals' as const, sortOrder: 7, unit: 'gram' },
  { id: '22ayar', name: '22 Ayar Bilezik', code: '22AYAR', category: 'metals' as const, sortOrder: 8, unit: 'gram' },
  { id: 'gremse', name: 'Gremse Altın', code: 'GREMSE', category: 'metals' as const, sortOrder: 9, unit: 'piece' },
  { id: 'gumus_gram', name: 'Gümüş (Gram)', code: 'XAG/TRY', category: 'metals' as const, sortOrder: 10, unit: 'gram' },
  { id: 'gumus_ons', name: 'Gümüş (Ons)', code: 'XAG/USD', category: 'metals' as const, sortOrder: 11, unit: 'oz' },
];

const fxInstruments = [
  { id: 'USDTRY', name: 'Dolar', code: 'USD/TRY', category: 'fx' as const, sortOrder: 1, quoteCurrency: 'TRY' },
  { id: 'EURTRY', name: 'Euro', code: 'EUR/TRY', category: 'fx' as const, sortOrder: 2, quoteCurrency: 'TRY' },
  { id: 'EURUSD', name: 'Euro/Dolar', code: 'EUR/USD', category: 'fx' as const, sortOrder: 3, quoteCurrency: 'USD' },
  { id: 'GBPTRY', name: 'Sterlin', code: 'GBP/TRY', category: 'fx' as const, sortOrder: 4, quoteCurrency: 'TRY' },
  { id: 'CHFTRY', name: 'İsviçre Frangı', code: 'CHF/TRY', category: 'fx' as const, sortOrder: 5, quoteCurrency: 'TRY' },
  { id: 'AUDTRY', name: 'Avustralya Doları', code: 'AUD/TRY', category: 'fx' as const, sortOrder: 6, quoteCurrency: 'TRY' },
  { id: 'CADTRY', name: 'Kanada Doları', code: 'CAD/TRY', category: 'fx' as const, sortOrder: 7, quoteCurrency: 'TRY' },
  { id: 'SARTRY', name: 'Suudi Riyali', code: 'SAR/TRY', category: 'fx' as const, sortOrder: 8, quoteCurrency: 'TRY' },
  { id: 'JPYTRY', name: 'Japon Yeni', code: 'JPY/TRY', category: 'fx' as const, sortOrder: 9, quoteCurrency: 'TRY' },
];

async function seed() {
  try {
    logger.info('Starting database seed...');

    // Insert metal instruments
    logger.info('Seeding metal instruments...');
    for (const instrument of metalInstruments) {
      await db
        .insert(instruments)
        .values(instrument)
        .onConflictDoNothing();
    }
    logger.info({ count: metalInstruments.length }, 'Metal instruments seeded');

    // Insert forex instruments
    logger.info('Seeding forex instruments...');
    for (const instrument of fxInstruments) {
      await db
        .insert(instruments)
        .values(instrument)
        .onConflictDoNothing();
    }
    logger.info({ count: fxInstruments.length }, 'Forex instruments seeded');

    logger.info('Database seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Database seed failed');
    process.exit(1);
  }
}

seed();
