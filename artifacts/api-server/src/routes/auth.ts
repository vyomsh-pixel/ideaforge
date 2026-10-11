import { Router, type IRouter, type Request } from "express";
import crypto from "node:crypto";
import { desc } from "drizzle-orm";
import { db, generationsTable, isDbConfigured } from "@workspace/db";
import {
  getFallbackGenerations,
  clearFallbackGenerations,
} from "./generations/index.js";

const router: IRouter = Router();

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  passwordHash: string;
  consentAccepted: boolean;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  consentAccepted: boolean;
  createdAt: string;
}

export interface TokenPayload {
  sub: number;
  username: string;
  displayName: string;
  consentAccepted: boolean;
  createdAt: string;
  exp: number;
}

const usersByUsername = new Map<string, UserRecord>();
const usersById = new Map<number, UserRecord>();
const deletedUserIds = new Set<number>();
let nextUserId = 1;

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "ideaforge-dev-secret";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function createAuthToken(
  user: Pick<
    PublicUser,
    "id" | "username" | "displayName" | "consentAccepted" | "createdAt"
  >,
  ttlMs = 7 * 24 * 60 * 60 * 1000,
): string {
  const payload: TokenPayload = {
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    consentAccepted: user.consentAccepted,
    createdAt: user.createdAt,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sigB64 = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sigB64}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSigB64 = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(sigB64, "utf8");
  const expectedBuf = Buffer.from(expectedSigB64, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (
      typeof parsed.sub !== "number" ||
      typeof parsed.username !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    if (deletedUserIds.has(parsed.sub)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    consentAccepted: user.consentAccepted,
    createdAt: user.createdAt,
  };
}

function getAuthenticatedUser(req: Request): PublicUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const existing = usersById.get(payload.sub);
  if (existing) {
    return toPublicUser(existing);
  }

  return {
    id: payload.sub,
    username: payload.username,
    displayName: payload.displayName || payload.username,
    consentAccepted: payload.consentAccepted ?? true,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

// POST /api/auth/register
router.post("/auth/register", (req, res): void => {
  const { username, password, displayName, consentAccepted } = (req.body ??
    {}) as {
    username?: unknown;
    password?: unknown;
    displayName?: unknown;
    consentAccepted?: unknown;
  };

  if (typeof username !== "string" || username.trim().length < 2 || username.trim().length > 64) {
    res.status(400).json({ error: "Username must be between 2 and 64 characters" });
    return;
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    res.status(400).json({ error: "Password must be between 6 and 128 characters" });
    return;
  }
  if (consentAccepted === false) {
    res.status(400).json({ error: "Privacy and AI processing consent is required" });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (usersByUsername.has(normalizedUsername)) {
    res.status(409).json({ error: "Username is already registered" });
    return;
  }

  const cleanDisplayName =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim().slice(0, 100)
      : username.trim();

  const userRecord: UserRecord = {
    id: nextUserId++,
    username: normalizedUsername,
    displayName: cleanDisplayName,
    passwordHash: hashPassword(password),
    consentAccepted: Boolean(consentAccepted ?? true),
    createdAt: new Date().toISOString(),
  };

  usersByUsername.set(normalizedUsername, userRecord);
  usersById.set(userRecord.id, userRecord);

  const user = toPublicUser(userRecord);
  const token = createAuthToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post("/auth/login", (req, res): void => {
  const { username, password } = (req.body ?? {}) as {
    username?: unknown;
    password?: unknown;
  };

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const userRecord = usersByUsername.get(normalizedUsername);

  if (!userRecord || !verifyPassword(password, userRecord.passwordHash)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const user = toPublicUser(userRecord);
  const token = createAuthToken(user);
  res.json({ token, user });
});

// GET /api/auth/me
router.get("/auth/me", (req, res): void => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired authentication token" });
    return;
  }
  res.json({ user });
});

// GET /api/account/export
router.get("/account/export", async (req, res): Promise<void> => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let generations: unknown[] = [];
  if (isDbConfigured) {
    try {
      const rows = await db
        .select()
        .from(generationsTable)
        .orderBy(desc(generationsTable.createdAt))
        .limit(100);
      generations = rows.map((gen) => ({
        id: gen.id,
        outputType: gen.outputType,
        status: gen.status,
        idea: gen.idea,
        title: gen.title,
        plan: gen.plan,
        result: gen.result,
        errorMessage: gen.errorMessage,
        createdAt: gen.createdAt.toISOString(),
        updatedAt: gen.updatedAt.toISOString(),
      }));
    } catch {
      generations = getFallbackGenerations();
    }
  } else {
    generations = getFallbackGenerations();
  }

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="ideaforge-data-export.json"',
  );
  res.json({
    user,
    generations,
    exportedAt: new Date().toISOString(),
  });
});

// DELETE /api/account
router.delete("/account", async (req, res): Promise<void> => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  deletedUserIds.add(user.id);
  usersById.delete(user.id);
  usersByUsername.delete(user.username.toLowerCase());
  clearFallbackGenerations();

  if (isDbConfigured) {
    try {
      await db.delete(generationsTable);
    } catch {
      // Ignore DB offline error during local dev account deletion
    }
  }

  res.json({ status: "deleted" });
});

export default router;
