import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { verifyPassword } from "./password";

export type Role = "manager" | "user";

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
}

const COOKIE = "ey_session";
const SESSION_HOURS = 12;

export async function login(username: string, password: string): Promise<boolean> {
  const db = getDb();
  const row = db
    .prepare("SELECT id, password_hash FROM users WHERE username = ? AND active = 1")
    .get(username) as { id: number; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return false;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    row.id,
    expires.toISOString().replace("T", " ").slice(0, 19)
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure cookies need HTTPS. Set COOKIE_SECURE=false only if the app is served over plain HTTP.
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return true;
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const user = getDb()
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
    )
    .get(token) as SessionUser | undefined;
  return user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/cases?error=forbidden");
  return user;
}
