INSERT OR IGNORE INTO users (
  id,
  display_name,
  email,
  avatar_url,
  authentication_provider,
  provider_user_id,
  is_guest
) VALUES
  ('seed-user-owner', 'Room Owner', 'owner@example.com', NULL, 'development', 'owner', 0),
  ('seed-user-alice', 'Alice', 'alice@example.com', NULL, 'development', 'alice', 0),
  ('seed-user-bob', 'Bob', NULL, NULL, 'guest', 'bob', 1);

INSERT OR IGNORE INTO poker_rooms (
  id,
  room_code,
  name,
  description,
  owner_id,
  settings_json,
  is_active
) VALUES (
  'seed-room-planning',
  'PLANNING',
  'Planning Sprint',
  'Development seed room',
  'seed-user-owner',
  '{"deck":"fibonacci","allowSpecialValues":true}',
  1
);

INSERT OR IGNORE INTO room_members (
  id,
  room_id,
  user_id,
  role,
  is_active
) VALUES
  ('seed-member-owner', 'seed-room-planning', 'seed-user-owner', 'owner', 1),
  ('seed-member-alice', 'seed-room-planning', 'seed-user-alice', 'participant', 1),
  ('seed-member-bob', 'seed-room-planning', 'seed-user-bob', 'participant', 1);

INSERT OR IGNORE INTO poker_sessions (
  id,
  room_id,
  name,
  status
) VALUES (
  'seed-session-sprint',
  'seed-room-planning',
  'Sprint Planning',
  'active'
);

INSERT OR IGNORE INTO poker_stories (
  id,
  session_id,
  title,
  description,
  acceptance_criteria,
  ticket_url,
  display_order,
  status
) VALUES (
  'seed-story-auth',
  'seed-session-sprint',
  'Implement authentication',
  'Add account authentication to the application',
  'Users can sign in and remain authenticated',
  'https://example.com/tickets/AUTH-1',
  0,
  'pending'
);
