-- Cihaz push token'larını saklama tablosu
CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" varchar(512) NOT NULL,
  "platform" varchar(10) NOT NULL,
  "device_id" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "platform_check" CHECK ("platform" IN ('ios', 'android'))
);

CREATE INDEX IF NOT EXISTS "idx_device_tokens_user" ON "device_tokens" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_device_tokens_token" ON "device_tokens" ("token");
