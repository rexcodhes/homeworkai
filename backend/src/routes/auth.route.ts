import { Router } from "express";
import { login } from "../controller/auth.controller";

const authRoutes: Router = Router();

authRoutes.post("/login", login);

export default authRoutes;