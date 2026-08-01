CREATE TABLE IF NOT EXISTS `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`year` integer,
	`raw_value` real NOT NULL,
	`comp_value` real NOT NULL,
	`image_key` text,
	`created_at` integer NOT NULL
);
