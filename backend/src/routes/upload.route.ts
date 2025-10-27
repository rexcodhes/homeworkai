import { Router } from "express";
import {
  presignUpload,
  confirmUpload,
  listUpload,
  getUpload,
  deleteUpload,
} from "../controller/upload.controller";
import { renderAnalysis } from "../controller/render.controller";

const uploadRoutes: Router = Router();

uploadRoutes.post("/presign", presignUpload);
uploadRoutes.post("/confirm", confirmUpload);
uploadRoutes.get("/list", listUpload);
uploadRoutes.get("/:uploadId", getUpload);
uploadRoutes.delete("/:uploadId/delete", deleteUpload);
uploadRoutes.post("/:uploadId/analyses/:analysisId/render", renderAnalysis);

export default uploadRoutes;
