-- Favori enstrümanlar tablosu
CREATE TABLE IF NOT EXISTS "user_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorites_user" ON "user_favorites" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_favorites_user_instrument" ON "user_favorites" USING btree ("user_id", "instrument_id");
--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;

-- Üste sabitlenen enstrümanlar tablosu
CREATE TABLE IF NOT EXISTS "user_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" varchar(50) NOT NULL,
	"sort_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pins_user" ON "user_pins" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pins_user_instrument" ON "user_pins" USING btree ("user_id", "instrument_id");
--> statement-breakpoint
ALTER TABLE "user_pins" ADD CONSTRAINT "user_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_pins" ADD CONSTRAINT "user_pins_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;

-- Fiyat alarm kuralları tablosu
CREATE TABLE IF NOT EXISTS "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" varchar(50) NOT NULL,
	"alert_type" varchar(20) NOT NULL,
	"direction" varchar(10),
	"threshold_value" numeric(18, 6),
	"scheduled_times" text,
	"is_active" boolean NOT NULL DEFAULT true,
	"reference_price" numeric(18, 6),
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_type_check" CHECK ("price_alerts"."alert_type" IN ('percentage', 'amount', 'scheduled')),
	CONSTRAINT "direction_check" CHECK ("price_alerts"."direction" IS NULL OR "price_alerts"."direction" IN ('up', 'down', 'any'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alerts_user" ON "price_alerts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alerts_instrument" ON "price_alerts" USING btree ("instrument_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alerts_active" ON "price_alerts" USING btree ("user_id", "is_active");
--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;
