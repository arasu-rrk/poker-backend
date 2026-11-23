CREATE TABLE `connection_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_hash` text NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_connection_tickets_ticket_hash` ON `connection_tickets` (`ticket_hash`);--> statement-breakpoint
CREATE INDEX `idx_connection_tickets_room_id` ON `connection_tickets` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_connection_tickets_user_id` ON `connection_tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_connection_tickets_expires_at` ON `connection_tickets` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_room_members_role" CHECK("__new_room_members"."role" in ('owner', 'moderator', 'participant', 'observer'))
);
--> statement-breakpoint
INSERT INTO `__new_room_members`("id", "room_id", "user_id", "role", "joined_at", "last_seen_at", "is_active") SELECT "id", "room_id", "user_id", "role", "joined_at", "last_seen_at", "is_active" FROM `room_members`;--> statement-breakpoint
DROP TABLE `room_members`;--> statement-breakpoint
ALTER TABLE `__new_room_members` RENAME TO `room_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_room_members_room_user` ON `room_members` (`room_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_room_members_user_id` ON `room_members` (`user_id`);