import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/user.route";
import parseRoutes from "./routes/parse.route";
import uploadRoutes from "./routes/upload.route";

dotenv.config();

const PORT = process.env.PORT || "3000";

export const app = express();

app.use(cors());
app.use(express.json());

const apiRoutes = express.Router();

app.use("/api/v1", apiRoutes);

apiRoutes.use("/users", userRoutes);
apiRoutes.use("/parse", parseRoutes);
apiRoutes.use("/upload", uploadRoutes);

app.listen(PORT, () => {
  console.log("Server is running");
});
