import { Router } from "express";
import { runAnalysis } from "../controller/analyze.controller";

const analyzeRoutes: Router = Router();

analyzeRoutes.post("/:uploadId", runAnalysis);

export default analyzeRoutes;
