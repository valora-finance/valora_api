-- Kullanıcı bildirim tercihleri tablosu
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "general_notifications" boolean NOT NULL DEFAULT true,
  "price_alert_notifications" boolean NOT NULL DEFAULT false,
  "zekat_notifications" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
