-- Firebase Auth entegrasyonu: users tablosuna firebase_uid kolonu eklendi
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) UNIQUE;
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
