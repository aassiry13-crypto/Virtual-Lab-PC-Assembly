import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import {
  emptyWeek,
  mastery,
  type Progress,
  type WeekProgress,
} from "../src/curriculum";
const scrypt = promisify(scryptCallback);
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return {
    salt,
    hash: ((await scrypt(password, salt, 64)) as Buffer).toString("hex"),
  };
}
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
) {
  const candidate = await passwordHash(password, salt);
  return timingSafeEqual(
    Buffer.from(candidate.hash, "hex"),
    Buffer.from(hash, "hex"),
  );
}
export function openStore(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, "maintenance.sqlite");
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,training_number TEXT NOT NULL UNIQUE,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'trainee' CHECK(role IN ('trainee','trainer')));
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 19),payload TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,week));
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,week INTEGER NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL,finished INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,score INTEGER);
 CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id,created);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),week INTEGER NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  function getProgress(userId: number): Progress {
    const result: Progress = {};
    for (const r of db
      .prepare("SELECT week,payload FROM progress WHERE user_id=?")
      .all(userId) as any[])
      result[String(r.week)] = JSON.parse(r.payload);
    return result;
  }
  function update(
    userId: number,
    week: number,
    patch: Partial<WeekProgress>,
    kind: string,
  ) {
    const old = getProgress(userId)[week] || emptyWeek();
    const p = { ...old, ...patch };
    p.mastered = mastery(p, week);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "INSERT INTO progress(user_id,week,payload) VALUES(?,?,?) ON CONFLICT(user_id,week) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP",
      ).run(userId, week, JSON.stringify(p));
      db.prepare("INSERT INTO events(user_id,week,kind) VALUES(?,?,?)").run(
        userId,
        week,
        kind,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return getProgress(userId);
  }
  return { db, getProgress, update };
}
export type Store = ReturnType<typeof openStore>;
