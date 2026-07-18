CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`score` integer NOT NULL,
	`mode` text NOT NULL,
	`skin` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`played_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scores_rank_idx` ON `scores` (`score`,`played_at`);--> statement-breakpoint
CREATE INDEX `scores_player_idx` ON `scores` (`player_id`,`played_at`);