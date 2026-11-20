CREATE TABLE "onboarding_answers" (
	"address" text PRIMARY KEY NOT NULL,
	"profile" text NOT NULL,
	"goals" text[] NOT NULL,
	"source" text,
	"source_detail" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
