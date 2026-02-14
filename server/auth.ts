import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// ============ PASSWORD HASHING ============

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============ JWT TOKENS ============

const JWT_SECRET = process.env.JWT_SECRET || "routesimply-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = "7d"; // tokens last 7 days

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ============ AUTH MIDDLEWARE ============

// Extend Express Request to include authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware that requires a valid JWT token.
 * Extracts token from Authorization header (Bearer <token>).
 * Attaches decoded user info to req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Middleware that requires a specific role (or array of roles).
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

/**
 * Middleware that ensures a driver can only access their own resources.
 * Admins bypass this check.
 * Checks req.params.id or req.query.driverId against the authenticated user.
 */
export function requireSelfOrAdmin(paramName: string = "id") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Admins can access any resource
    if (req.user.role === "admin") {
      return next();
    }

    // Drivers can only access their own resources
    const targetId = req.params[paramName] || req.query.driverId;
    if (targetId && targetId !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
}

// ============ PASSWORD MIGRATION HELPER ============

/**
 * Check if a password string looks like a bcrypt hash.
 * Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long.
 */
export function isBcryptHash(str: string): boolean {
  return /^\$2[aby]\$\d{1,2}\$.{53}$/.test(str);
}

/**
 * Authenticate a user, handling both legacy plaintext and new bcrypt passwords.
 * If a plaintext password match is found, it auto-migrates to bcrypt.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ userId: string; username: string; role: string; name: string } | null> {
  const user = await storage.getUserByUsername(username);
  if (!user) return null;

  if (isBcryptHash(user.password)) {
    // Modern: compare against bcrypt hash
    const valid = await comparePassword(password, user.password);
    if (!valid) return null;
  } else {
    // Legacy: plaintext comparison, then auto-migrate
    if (user.password !== password) return null;

    // Migrate plaintext password to bcrypt
    const hashed = await hashPassword(password);
    await storage.updateUser(user.id, { password: hashed });
    console.log(`Migrated password to bcrypt for user: ${username}`);
  }

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  };
}
