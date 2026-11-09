CREATE TABLE `content_catalog` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`draft_json` text NOT NULL,
	`published_id` text,
	`published_revision` integer,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `content_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_revision` integer NOT NULL,
	`worlds_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_world_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`world_json` text NOT NULL,
	`created_at` text NOT NULL
);
