ALTER TABLE "bids" ADD COLUMN "requested_amount" bigint;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "wants_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_email_outbox_idx" ON "notifications" USING btree ("created_at") WHERE wants_email and emailed_at is null;