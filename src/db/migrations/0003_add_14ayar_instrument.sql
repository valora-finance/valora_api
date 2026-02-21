-- Add 14 Ayar Altın instrument
-- Current price is derived from gram altın (×14/24) via truncgil_calculated
-- Historical data is backfilled from haremaltin.com via HAREMALTIN_CF_CLEARANCE

INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES ('14ayar', 'metals', '14 Ayar Altın', 'XAU', 'TRY', 'gram', 9)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Shift sort_order for instruments that come after 14ayar (gremse, gumus_gram, gumus_ons)
UPDATE instruments SET sort_order = 10 WHERE id = 'gremse';
UPDATE instruments SET sort_order = 11 WHERE id = 'gumus_gram';
UPDATE instruments SET sort_order = 12 WHERE id = 'gumus_ons';
