-- Remove "eski" (old) gold coin variants - no eski/yeni distinction needed
-- Also rename "Yeni" names to plain names in instruments table

-- Delete all data for eski instruments
DELETE FROM quotes WHERE instrument_id IN (
  'ceyrek_eski', 'yarim_eski', 'tam_eski', 'ata_eski', 'ata5_eski', 'gremse_eski'
);

DELETE FROM latest_quotes WHERE instrument_id IN (
  'ceyrek_eski', 'yarim_eski', 'tam_eski', 'ata_eski', 'ata5_eski', 'gremse_eski'
);

-- Remove eski instruments from instruments table
DELETE FROM instruments WHERE id IN (
  'ceyrek_eski', 'yarim_eski', 'tam_eski', 'ata_eski', 'ata5_eski', 'gremse_eski'
);

-- Rename remaining coins: remove "Yeni" prefix
UPDATE instruments SET name = 'Çeyrek Altın' WHERE id = 'ceyrek';
UPDATE instruments SET name = 'Yarım Altın' WHERE id = 'yarim';
UPDATE instruments SET name = 'Tam Altın' WHERE id = 'tam';
UPDATE instruments SET name = 'Ata Altın' WHERE id = 'ata';
UPDATE instruments SET name = 'Ata 5''li' WHERE id = 'ata5';
UPDATE instruments SET name = 'Gremse Altın' WHERE id = 'gremse';

-- Fix sort orders (close the gap left by removed instruments)
UPDATE instruments SET sort_order = 12 WHERE id = 'gumus_gram';
UPDATE instruments SET sort_order = 13 WHERE id = 'gumus_ons';
UPDATE instruments SET sort_order = 14 WHERE id = 'gumus_usd';
UPDATE instruments SET sort_order = 15 WHERE id = 'platin_gram';
UPDATE instruments SET sort_order = 16 WHERE id = 'platin_ons';
UPDATE instruments SET sort_order = 17 WHERE id = 'platin';
UPDATE instruments SET sort_order = 18 WHERE id = 'paladyum_gram';
UPDATE instruments SET sort_order = 19 WHERE id = 'paladyum_ons';
UPDATE instruments SET sort_order = 20 WHERE id = 'paladyum';
UPDATE instruments SET sort_order = 21 WHERE id = 'usdkg';
UPDATE instruments SET sort_order = 22 WHERE id = 'eurkg';
UPDATE instruments SET sort_order = 23 WHERE id = 'xauxag';
