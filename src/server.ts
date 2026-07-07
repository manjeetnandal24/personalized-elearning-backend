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
import enrollmentRouter from "./routes/enrollmentRoutes.js";
import certificateRouter from "./routes/certificateRoutes.js";
import adminAnalyticsRouter from "./routes/adminAnalyticsRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import adminStudentRouter from "./routes/adminStudentRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import instructorRouter from "./routes/instructorRoutes.js";
import adminInstructorRouter from "./routes/adminInstructorRoutes.js";
import announcementRouter from "./routes/announcementRoutes.js";
import courseResourceRouter from "./routes/courseResourceRoutes.js";
import courseDiscussionRouter from "./routes/courseDiscussionRoutes.js";


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
app.use("/api/enrollments", enrollmentRouter);
app.use("/api/certificates", certificateRouter);
app.use("/api/admin/analytics", adminAnalyticsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/admin/students", adminStudentRouter);
app.use("/api/ai", aiRouter);
app.use("/api/instructor", instructorRouter);
app.use("/api/admin/instructors", adminInstructorRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/course-resources", courseResourceRouter);
app.use("/api/discussions", courseDiscussionRouter);

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