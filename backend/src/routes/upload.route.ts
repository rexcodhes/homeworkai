import { Router } from "express";
import { presignUpload, confirmUpload } from "../controller/upload.controller";

const uploadRoutes: Router = Router();

uploadRoutes.post("/presign", presignUpload);
uploadRoutes.post("/confirm", confirmUpload);

export default uploadRoutes;
