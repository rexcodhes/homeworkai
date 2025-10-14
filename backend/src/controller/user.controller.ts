import { Request, Response } from "express";
import { userSchema } from "../schema/user.schema";
import { prisma } from "../db/prisma";
import bcrypt from "bcrypt";

export async function createUser(req: Request, res: Response) {
  const parsed = userSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).send({ error: "Invalid body" });
  }

  const { name, email } = parsed.data;
  const password = await bcrypt.hash(parsed.data.password, 10);

  try {
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });
    return res
      .status(201)
      .json({ userId: newUser.id, name: newUser.name, email: newUser.email });
  } catch (error) {
    console.error("Create user failed:", error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
