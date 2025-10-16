import { Router } from "express";
import { parsePDFController } from "../controller/parse.controller";

const parseRoutes: Router = Router();

parseRoutes.post("/:uploadId/parse", parsePDFController);

export default parseRoutes;
