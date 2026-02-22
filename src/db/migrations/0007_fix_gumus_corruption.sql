-- Remove all corrupted gumus_gram data.
-- The quotes table contained 10,000x inflated values from Haremaltin backfill
-- (e.g. 127,745 TRY instead of the correct ~12 TRY range).
-- The altin.in backfill (kur=XAG, banka=_gumus) will re-populate
-- clean data automatically on the next server startup.

DELETE FROM quotes WHERE instrument_id = 'gumus_gram';
DELETE FROM latest_quotes WHERE instrument_id = 'gumus_gram';
