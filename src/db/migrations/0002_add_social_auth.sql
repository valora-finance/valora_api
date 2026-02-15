-- Add social auth columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" varchar(20) NOT NULL DEFAULT 'email';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider_id" varchar(255);

-- Make password_hash nullable (social auth users don't have passwords)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Create composite index for social auth lookup
CREATE INDEX IF NOT EXISTS "idx_users_provider_provider_id" ON "users" USING btree ("provider", "provider_id");
