import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createD1Database } from "../src/client";

function openMigratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  for (const migrationFile of ["0000_daily_christian_walker.sql", "0001_luxuriant_karma.sql"]) {
    const migrationUrl = new URL(`../migrations/${migrationFile}`, import.meta.url);
    const migrationPath = fileURLToPath(migrationUrl);
    const sql = readFileSync(migrationPath, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

describe("database foundation", () => {
  it("executes the generated migration and creates the schema", () => {
    const database = openMigratedDatabase();
    const table = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get();
    expect(table).toEqual({ name: "users" });
  });

  it("creates a Drizzle database client", () => {
    const mockD1 = {
      prepare: () => ({ bind: () => ({}), all: () => Promise.resolve({ results: [] }) })
    } as unknown as D1Database;
    expect(createD1Database(mockD1).select).toBeTypeOf("function");
  });

  it("prevents duplicate room memberships", () => {
    const database = openMigratedDatabase();
    database.exec(`
      INSERT INTO users (id, display_name, authentication_provider, provider_user_id)
      VALUES ('u1', 'User', 'guest', 'u1');
      INSERT INTO poker_rooms (id, room_code, name, owner_id)
      VALUES ('r1', 'ROOM1', 'Room', 'u1');
      INSERT INTO room_members (id, room_id, user_id, role)
      VALUES ('m1', 'r1', 'u1', 'participant');
    `);

    expect(() =>
      database.exec(
        "INSERT INTO room_members (id, room_id, user_id, role) VALUES ('m2', 'r1', 'u1', 'participant');"
      )
    ).toThrow();
  });

  it("prevents duplicate votes in one round", () => {
    const database = openMigratedDatabase();
    database.exec(`
      INSERT INTO users (id, display_name, authentication_provider, provider_user_id)
      VALUES ('u1', 'User', 'guest', 'u1');
      INSERT INTO poker_rooms (id, room_code, name, owner_id)
      VALUES ('r1', 'ROOM1', 'Room', 'u1');
      INSERT INTO poker_sessions (id, room_id, name, status)
      VALUES ('s1', 'r1', 'Session', 'active');
      INSERT INTO poker_stories (id, session_id, title, display_order, status)
      VALUES ('story1', 's1', 'Story', 0, 'pending');
      INSERT INTO voting_rounds (id, story_id, session_id, round_number, status)
      VALUES ('round1', 'story1', 's1', 1, 'open');
      INSERT INTO votes (id, voting_round_id, user_id, vote_type, numeric_value)
      VALUES ('v1', 'round1', 'u1', 'numeric', 5);
    `);

    expect(() =>
      database.exec(
        "INSERT INTO votes (id, voting_round_id, user_id, vote_type, numeric_value) VALUES ('v2', 'round1', 'u1', 'numeric', 8);"
      )
    ).toThrow();
  });

  it("enforces foreign keys", () => {
    const database = openMigratedDatabase();
    expect(() =>
      database.exec(
        "INSERT INTO poker_rooms (id, room_code, name, owner_id) VALUES ('r1', 'ROOM1', 'Room', 'missing-user');"
      )
    ).toThrow();
  });

  it("uses unique room codes", () => {
    const database = openMigratedDatabase();
    database.exec(`
      INSERT INTO users (id, display_name, authentication_provider, provider_user_id)
      VALUES ('u1', 'User', 'guest', 'u1');
      INSERT INTO poker_rooms (id, room_code, name, owner_id)
      VALUES ('r1', 'DUPLICATE', 'Room One', 'u1');
    `);
    expect(() =>
      database.exec(
        "INSERT INTO poker_rooms (id, room_code, name, owner_id) VALUES ('r2', 'DUPLICATE', 'Room Two', 'u1');"
      )
    ).toThrow();
  });

  it("stores hashed connection tickets and supports one-time use", () => {
    const database = openMigratedDatabase();
    database.exec(`
      INSERT INTO users (id, display_name, authentication_provider, provider_user_id)
      VALUES ('u1', 'User', 'guest', 'u1');
      INSERT INTO poker_rooms (id, room_code, name, owner_id)
      VALUES ('r1', 'TICKET1', 'Room', 'u1');
      INSERT INTO connection_tickets (id, ticket_hash, room_id, user_id, expires_at)
      VALUES ('ticket1', 'hashed-ticket', 'r1', 'u1', 2000000000000);
    `);
    const result = database
      .prepare(
        `select ticket_hash, room_id, user_id, used_at
         from connection_tickets where id = 'ticket1'`
      )
      .get();
    expect(result).toEqual({
      ticket_hash: "hashed-ticket",
      room_id: "r1",
      user_id: "u1",
      used_at: null
    });
  });
});
