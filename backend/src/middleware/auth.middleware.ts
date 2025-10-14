import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      typeof payload !== "object" ||
      !payload ||
      typeof (payload as any).id !== "number"
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = { id: (payload as any).id };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
