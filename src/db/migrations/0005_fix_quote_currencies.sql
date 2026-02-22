-- Ensure 14ayar instrument exists (migration 0003 may have been skipped)
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES ('14ayar', 'metals', '14 Ayar Altın', 'XAU', 'TRY', 'gram', 5)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Fix quote_currency for USD-denominated instruments
-- Both Truncgil and Haremaltin return these in USD, not TRY
UPDATE instruments SET quote_currency = 'USD' WHERE id IN (
  'ons',            -- XAU/USD (Gold Ounce — Truncgil returns $, Haremaltin also USD)
  'gumus_ons',      -- XAGUSD (Silver Ounce USD)
  'gumus_usd',      -- GUMUSUSD (Silver USD)
  'platin_ons',     -- XPTUSD (Platinum Ounce USD)
  'paladyum_ons',   -- XPDUSD (Palladium Ounce USD)
  'usdkg'           -- USDKG (Gold USD/KG)
);
--> statement-breakpoint

-- EUR-denominated instrument
UPDATE instruments SET quote_currency = 'EUR' WHERE id = 'eurkg';
--> statement-breakpoint

-- Ratio (unitless)
UPDATE instruments SET quote_currency = 'RATIO' WHERE id = 'xauxag';
--> statement-breakpoint

-- Clean up NaN ons quotes from Truncgil ($ parsing issue in earlier deployment)
DELETE FROM quotes
WHERE instrument_id = 'ons'
AND source = 'truncgil'
AND (price = 'NaN' OR price IS NULL);
--> statement-breakpoint

-- Reset latest_quotes for ons so next refresh gets valid data
DELETE FROM latest_quotes WHERE instrument_id = 'ons';
--> statement-breakpoint

-- Remove calculated gumus_ons from latest (source = truncgil_calculated violates CLAUDE.md)
DELETE FROM latest_quotes WHERE instrument_id = 'gumus_ons' AND source = 'truncgil_calculated';
