import { Router } from "express";
import { getAnalysis, runAnalysis } from "../controller/analyze.controller";

const analyzeRoutes: Router = Router();

analyzeRoutes.post("/:uploadId", runAnalysis);
analyzeRoutes.get("/:uploadId/:analysisId", getAnalysis);

export default analyzeRoutes;
