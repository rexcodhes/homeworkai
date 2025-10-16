import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { loginSchema } from "../schema/auth.schema";
import jwt from "jsonwebtoken";
import dontenv from "dotenv";
import bcrypt from "bcrypt";

dontenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not found");
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send({ error: "Invalid credentials" });
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}

