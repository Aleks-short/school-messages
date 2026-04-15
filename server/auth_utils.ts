import type { Database } from "sql.js";
import { queryOne } from "./database.js";
import crypto from "node:crypto";

const JWT_SECRET = "edu-poshta-secret-key-123";

export function signToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${p}`).digest("base64url");
  return `${header}.${p}.${signature}`;
}

export function verifyToken(token: string): any | null {
  try {
    const [header, payload, signature] = token.split(".");
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function getUserFromRequest(db: Database, req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) return null;

  return queryOne(db, "SELECT * FROM users WHERE id = ?", [decoded.id]);
}
