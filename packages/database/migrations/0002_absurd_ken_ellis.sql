CREATE TABLE `room_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invited_email` text,
	`invited_role` text DEFAULT 'participant' NOT NULL,
	`invitation_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_room_invitations_role" CHECK("room_invitations"."invited_role" in ('moderator', 'participant', 'observer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_room_invitations_token_hash` ON `room_invitations` (`invitation_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_room_invitations_room_id` ON `room_invitations` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_room_invitations_invited_email` ON `room_invitations` (`invited_email`);