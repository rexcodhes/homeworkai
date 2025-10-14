import { Request, Response } from "express";
import { userSchema } from "../schema/user.schema";
import { prisma } from "../db/prisma";

export async function createUser(req: Request, res: Response) {
  const parsed = userSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).send({ error: "Invalid body" });
  }

  const { name, email, password } = parsed.data;
  try {
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
