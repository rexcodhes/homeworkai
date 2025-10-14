import { Router } from "express";
import { createUser } from "../controller/user.controller";
const userRoutes = Router();

userRoutes.post("/", createUser);

export default userRoutes;
