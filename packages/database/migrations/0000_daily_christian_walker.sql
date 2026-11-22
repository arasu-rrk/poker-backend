CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_room_created` ON `audit_logs` (`room_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor_user_id` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `poker_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_id` text NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_poker_rooms_room_code` ON `poker_rooms` (`room_code`);--> statement-breakpoint
CREATE INDEX `idx_poker_rooms_owner_id` ON `poker_rooms` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_poker_rooms_is_active` ON `poker_rooms` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_poker_rooms_deleted_at` ON `poker_rooms` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `poker_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_poker_sessions_status" CHECK("poker_sessions"."status" in ('draft', 'active', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_poker_sessions_id_room` ON `poker_sessions` (`id`,`room_id`);--> statement-breakpoint
CREATE INDEX `idx_poker_sessions_room_id` ON `poker_sessions` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_poker_sessions_status` ON `poker_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `poker_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`acceptance_criteria` text,
	`ticket_url` text,
	`display_order` integer NOT NULL,
	`status` text NOT NULL,
	`final_estimate` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `poker_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_poker_stories_display_order" CHECK("poker_stories"."display_order" >= 0),
	CONSTRAINT "ck_poker_stories_status" CHECK("poker_stories"."status" in ('pending', 'voting', 'estimated', 'skipped', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_poker_stories_id_session` ON `poker_stories` (`id`,`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_poker_stories_session_order` ON `poker_stories` (`session_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_poker_stories_session_id` ON `poker_stories` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_poker_stories_status` ON `poker_stories` (`status`);--> statement-breakpoint
CREATE INDEX `idx_poker_stories_deleted_at` ON `poker_stories` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `poker_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_room_members_role" CHECK("room_members"."role" in ('owner', 'facilitator', 'participant'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_room_members_room_user` ON `room_members` (`room_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_room_members_user_id` ON `room_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_user_sessions_not_revoked_after_expiry" CHECK("user_sessions"."revoked_at" is null or "user_sessions"."revoked_at" <= "user_sessions"."expires_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_sessions_refresh_token_hash` ON `user_sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user_id` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_expires_at` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`avatar_url` text,
	`authentication_provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`is_guest` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_auth_provider` ON `users` (`authentication_provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_deleted_at` ON `users` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`voting_round_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote_type` text NOT NULL,
	`numeric_value` integer,
	`special_value` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`voting_round_id`) REFERENCES `voting_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_votes_vote_type" CHECK("votes"."vote_type" in ('numeric', 'special')),
	CONSTRAINT "ck_votes_numeric_pair" CHECK(("votes"."vote_type" = 'numeric' and "votes"."numeric_value" is not null and "votes"."special_value" is null) or ("votes"."vote_type" = 'special' and "votes"."special_value" is not null and "votes"."numeric_value" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_votes_round_user` ON `votes` (`voting_round_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_votes_user_id` ON `votes` (`user_id`);--> statement-breakpoint
CREATE TABLE `voting_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`session_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`status` text NOT NULL,
	`revealed_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_id`,`session_id`) REFERENCES `poker_stories`(`id`,`session_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_voting_rounds_round_number" CHECK("voting_rounds"."round_number" >= 1),
	CONSTRAINT "ck_voting_rounds_status" CHECK("voting_rounds"."status" in ('open', 'revealed', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_voting_rounds_story_number` ON `voting_rounds` (`story_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `idx_voting_rounds_session_id` ON `voting_rounds` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_voting_rounds_status` ON `voting_rounds` (`status`);