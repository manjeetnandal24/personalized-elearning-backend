import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

const enrollmentRouter = Router();

enrollmentRouter.use(authenticateUser);

enrollmentRouter.get("/courses/:courseId/status", async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const courseId = Number(req.params.courseId);
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    if (!courseId || Number.isNaN(courseId)) {
      res.status(400).json({ message: "Invalid course id." });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!course) {
      res.status(404).json({ message: "Course not found." });
      return;
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    res.json({
      courseId,
      courseTitle: course.title,
      isEnrolled: Boolean(enrollment),
      enrolledAt: enrollment?.enrolledAt ?? null,
    });
  } catch (error) {
    console.error("Enrollment status error:", error);
    res.status(500).json({ message: "Unable to check enrollment." });
  }
});

enrollmentRouter.post("/courses/:courseId", async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const courseId = Number(req.params.courseId);
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    if (!courseId || Number.isNaN(courseId)) {
      res.status(400).json({ message: "Invalid course id." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    if (user.role === "ADMIN") {
      res.status(403).json({
        message: "Admins cannot enroll as students.",
      });
      return;
    }

    const courseExists = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
      },
    });

    if (!courseExists) {
      res.status(404).json({ message: "Course not found." });
      return;
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      update: {},
      create: {
        userId,
        courseId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            shortName: true,
            level: true,
            instructor: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Course enrolled successfully.",
      enrollment,
    });
  } catch (error) {
    console.error("Course enrollment error:", error);
    res.status(500).json({ message: "Unable to enroll in course." });
  }
});

enrollmentRouter.get("/me", async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId,
      },
      orderBy: {
        enrolledAt: "desc",
      },
      include: {
        course: {
          include: {
            lessons: true,
            topics: {
              include: {
                lessons: true,
              },
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },
    });

    res.json(enrollments);
  } catch (error) {
    console.error("My enrollments error:", error);
    res.status(500).json({ message: "Unable to load enrollments." });
  }
});

export default enrollmentRouter;