/**
 * Authentication Middleware
 * Validates the `x-api-key` header on every request.
 * In production, set MCP_API_KEY via environment / Secrets Manager.
 */

import { Request, Response, NextFunction } from "express";

const API_KEY = process.env.MCP_API_KEY ?? "dev-secret-key";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for health check
  if (req.path === "/health") {
    next();
    return;
  }

  const provided = req.headers["x-api-key"];

  if (!provided || provided !== API_KEY) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid x-api-key header",
    });
    return;
  }

  next();
}
