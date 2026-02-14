CREATE TABLE "fetch_state" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"last_success_ts" bigint,
	"last_attempt_ts" bigint,
	"last_status" varchar(20),
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"category" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"quote_currency" varchar(10) DEFAULT 'TRY' NOT NULL,
	"unit" varchar(20),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_check" CHECK ("instruments"."category" IN ('metals', 'fx'))
);
--> statement-breakpoint
CREATE TABLE "latest_quotes" (
	"instrument_id" varchar(50) PRIMARY KEY NOT NULL,
	"ts" bigint NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"price_24h_ago" numeric(18, 6),
	"ts_24h_ago" bigint,
	"buy" numeric(18, 6),
	"sell" numeric(18, 6),
	"source" varchar(50) NOT NULL,
	"raw_data" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"instrument_id" varchar(50) NOT NULL,
	"ts" bigint NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"buy" numeric(18, 6),
	"sell" numeric(18, 6),
	"source" varchar(50) NOT NULL,
	"raw_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"api_key" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rate_limit_tier" varchar(20) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "latest_quotes" ADD CONSTRAINT "latest_quotes_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_instruments_category" ON "instruments" USING btree ("category") WHERE "instruments"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_latest_quotes_updated" ON "latest_quotes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_quotes_instrument_ts" ON "quotes" USING btree ("instrument_id","ts");--> statement-breakpoint
CREATE INDEX "idx_quotes_ts" ON "quotes" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "idx_users_api_key" ON "users" USING btree ("api_key") WHERE "users"."is_active" = true;