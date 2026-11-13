CREATE TABLE `npc_account_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`life_id` text NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `npc_ranked_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`life_key` text NOT NULL,
	`contract_id` text NOT NULL,
	`life_id` text NOT NULL,
	`account_id` text NOT NULL,
	`seed` text NOT NULL,
	`world_version` text NOT NULL,
	`world_fingerprint` text NOT NULL,
	`revision` integer NOT NULL,
	`token_hash` text NOT NULL,
	`record_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `npc_ranked_sessions_life_key_unique` ON `npc_ranked_sessions` (`life_key`);