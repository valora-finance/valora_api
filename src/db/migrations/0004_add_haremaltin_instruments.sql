-- Add all Haremaltin instruments that don't exist yet
-- Live data: Truncgil (ata5, platin_gram, paladyum_gram) + Haremaltin history endpoint (eski variants, USD-based, etc.)
-- Historical data: Haremaltin /ajax/cur/history

-- New gold coin instruments (eski variants)
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES
  ('ceyrek_eski', 'metals', 'Eski Çeyrek', 'XAU', 'TRY', 'piece', 12),
  ('yarim_eski', 'metals', 'Eski Yarım', 'XAU', 'TRY', 'piece', 13),
  ('tam_eski', 'metals', 'Eski Tam', 'XAU', 'TRY', 'piece', 14),
  ('ata_eski', 'metals', 'Eski Ata', 'XAU', 'TRY', 'piece', 15),
  ('ata5', 'metals', 'Yeni Ata 5''li', 'XAU', 'TRY', 'piece', 10),
  ('ata5_eski', 'metals', 'Eski Ata 5''li', 'XAU', 'TRY', 'piece', 16),
  ('gremse_eski', 'metals', 'Eski Gremse', 'XAU', 'TRY', 'piece', 17)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Silver USD
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES ('gumus_usd', 'metals', 'Gümüş USD', 'XAG', 'TRY', 'gram', 20)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Platinum & Palladium
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES
  ('platin_gram', 'metals', 'Platin (Gram)', 'XPT', 'TRY', 'gram', 21),
  ('platin_ons', 'metals', 'Platin (Ons)', 'XPT', 'TRY', 'ounce', 22),
  ('platin', 'metals', 'Platin TL', 'XPT', 'TRY', 'gram', 23),
  ('paladyum_gram', 'metals', 'Paladyum (Gram)', 'XPD', 'TRY', 'gram', 24),
  ('paladyum_ons', 'metals', 'Paladyum (Ons)', 'XPD', 'TRY', 'ounce', 25),
  ('paladyum', 'metals', 'Paladyum TL', 'XPD', 'TRY', 'gram', 26)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- International gold
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES
  ('usdkg', 'metals', 'USD/KG Altın', 'XAU', 'TRY', 'kg', 27),
  ('eurkg', 'metals', 'EUR/KG Altın', 'XAU', 'TRY', 'kg', 28)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Gold/Silver ratio
INSERT INTO instruments (id, category, name, code, quote_currency, unit, sort_order)
VALUES ('xauxag', 'metals', 'Altın/Gümüş Oranı', 'XAUXAG', 'TRY', 'ratio', 29)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Update existing instrument names to include Yeni/Eski distinction
UPDATE instruments SET name = 'Yeni Çeyrek' WHERE id = 'ceyrek';
UPDATE instruments SET name = 'Yeni Yarım' WHERE id = 'yarim';
UPDATE instruments SET name = 'Yeni Tam' WHERE id = 'tam';
UPDATE instruments SET name = 'Yeni Ata' WHERE id = 'ata';
UPDATE instruments SET name = 'Yeni Gremse' WHERE id = 'gremse';
--> statement-breakpoint

-- Update sort_order for existing instruments to match new grouping
UPDATE instruments SET sort_order = 1 WHERE id = 'gram';
UPDATE instruments SET sort_order = 2 WHERE id = 'has';
UPDATE instruments SET sort_order = 3 WHERE id = 'ons';
UPDATE instruments SET sort_order = 4 WHERE id = '22ayar';
UPDATE instruments SET sort_order = 5 WHERE id = '14ayar';
UPDATE instruments SET sort_order = 6 WHERE id = 'ceyrek';
UPDATE instruments SET sort_order = 7 WHERE id = 'yarim';
UPDATE instruments SET sort_order = 8 WHERE id = 'tam';
UPDATE instruments SET sort_order = 9 WHERE id = 'ata';
UPDATE instruments SET sort_order = 11 WHERE id = 'gremse';
UPDATE instruments SET sort_order = 18 WHERE id = 'gumus_gram';
UPDATE instruments SET sort_order = 19 WHERE id = 'gumus_ons';
