-- Drop old columns from users table
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_api_key_unique";
DROP INDEX IF EXISTS "idx_users_api_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "api_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "rate_limit_tier";

-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);
ALTER TABLE "users" ADD COLUMN "display_name" varchar(100);

-- Create index on email
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email") WHERE "users"."is_active" = true;

-- Create portfolios table
CREATE TABLE IF NOT EXISTS "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"icon" varchar(50) NOT NULL DEFAULT '💰',
	"color" varchar(20) NOT NULL DEFAULT '#C6A15B',
	"sort_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_type_check" CHECK ("portfolios"."type" IN ('birikim', 'borc'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolios_user" ON "portfolios" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Create portfolio_holdings table
CREATE TABLE IF NOT EXISTS "portfolio_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"instrument_id" varchar(50) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"purchase_price" numeric(18, 6) NOT NULL,
	"purchase_date" date NOT NULL,
	"description" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_holdings_portfolio" ON "portfolio_holdings" USING btree ("portfolio_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_holdings_instrument" ON "portfolio_holdings" USING btree ("instrument_id");
--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;
