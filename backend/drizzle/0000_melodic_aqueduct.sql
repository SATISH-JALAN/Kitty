CREATE TABLE "backups" (
	"key" text PRIMARY KEY NOT NULL,
	"pubkey" text NOT NULL,
	"ciphertext" text NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cursor" (
	"id" text PRIMARY KEY NOT NULL,
	"last_signature" text,
	"last_slot" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"signature" text NOT NULL,
	"idx" integer NOT NULL,
	"slot" bigint NOT NULL,
	"block_time" bigint,
	"name" text NOT NULL,
	"party" bigint,
	"data" jsonb NOT NULL,
	CONSTRAINT "events_signature_idx_pk" PRIMARY KEY("signature","idx")
);
--> statement-breakpoint
CREATE TABLE "faucet_drips" (
	"wallet" text NOT NULL,
	"ip" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"signature" text NOT NULL,
	"ok" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_flows" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" integer NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"party" bigint NOT NULL,
	"signature" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"index" bigint PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"kind" integer NOT NULL,
	"slot" bigint NOT NULL,
	"signature" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"claim" jsonb NOT NULL,
	"proof" jsonb NOT NULL,
	"public_signals" jsonb NOT NULL,
	"scope_label" text NOT NULL,
	"on_chain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_meta" (
	"party_id" bigint PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"word" text NOT NULL,
	"tradition" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_party" ON "events" USING btree ("party");--> statement-breakpoint
CREATE INDEX "events_name" ON "events" USING btree ("name");--> statement-breakpoint
CREATE INDEX "faucet_wallet" ON "faucet_drips" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "faucet_ip" ON "faucet_drips" USING btree ("ip");