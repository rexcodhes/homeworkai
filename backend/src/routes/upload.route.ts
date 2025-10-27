import { Router } from "express";
import {
  presignUpload,
  confirmUpload,
  listUpload,
  getUpload,
  deleteUpload,
} from "../controller/upload.controller";

const uploadRoutes: Router = Router();

uploadRoutes.post("/presign", presignUpload);
uploadRoutes.post("/confirm", confirmUpload);
uploadRoutes.get("/list", listUpload);
uploadRoutes.get("/:uploadId", getUpload);
uploadRoutes.delete("/:uploadId/delete", deleteUpload);

export default uploadRoutes;
