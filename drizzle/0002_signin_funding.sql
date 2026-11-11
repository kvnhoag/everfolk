CREATE TABLE `signin_funding` (
	`privy_user_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount` text NOT NULL,
	`tx_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signin_funding_account_id_unique` ON `signin_funding` (`account_id`);--> statement-breakpoint
CREATE INDEX `signin_funding_created_at_idx` ON `signin_funding` (`created_at`);