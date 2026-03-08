-- Email verifications table — kayıt sırasında e-posta doğrulama kodları
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "code" varchar(6) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_email_verifications_email" ON "email_verifications" ("email");
CREATE INDEX IF NOT EXISTS "idx_email_verifications_expires" ON "email_verifications" ("expires_at");
