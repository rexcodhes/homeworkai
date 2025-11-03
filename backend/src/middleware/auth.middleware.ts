import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
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
      typeof (payload as JwtPayload).userId !== "number"
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = { userId: (payload as JwtPayload).userId };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
