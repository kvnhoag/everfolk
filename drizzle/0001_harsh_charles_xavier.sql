CREATE TABLE `ranked_evidence` (
	`hash` text PRIMARY KEY NOT NULL,
	`evidence_json` text NOT NULL,
	`save_json` text NOT NULL,
	`created_at` text NOT NULL
);
