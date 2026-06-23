import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import authRouter from "./routes/authRoutes.js";

import { prisma } from "./lib/prisma.js";
import courseRouter from "./routes/courseRoutes.js";
import progressRouter from "./routes/progressRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import quizRouter from "./routes/quizRoutes.js";

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

app.get("/api/database-health", async (_request, response, next) => {
  try {
    const courseCount = await prisma.course.count();

    response.json({
      success: true,
      message: "Database is connected",
      courseCount,
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/courses", courseRouter);
app.use("/api/progress", progressRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/quizzes", quizRouter);

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error(error);

    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});