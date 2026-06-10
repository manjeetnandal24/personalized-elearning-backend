import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import courseRouter from "./routes/courseRoutes.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    message: "LearnTrack backend is running",
  });
});

app.get("/api/health", (_request, response) => {
  response.json({
    success: true,
    message: "Server is healthy",
  });
});

app.use("/api/courses", courseRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});