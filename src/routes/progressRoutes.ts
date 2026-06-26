import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const progressRouter = Router();

progressRouter.get(
  "/courses/:courseId",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const courseId = Number(request.params.courseId);

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user) {
        response.status(404).json({
          success: false,
          message: "User not found.",
        });

        return;
      }

      if (user.role === "ADMIN") {
        response.status(403).json({
          success: false,
          message: "Admins cannot track student progress.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        include: {
          lessons: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

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

      if (!enrollment) {
        response.status(403).json({
          success: false,
          message: "Please enroll in this course first.",
        });

        return;
      }

      const lessonIds = course.lessons.map((lesson) => lesson.id);

      const completedProgress = await prisma.progress.findMany({
        where: {
          userId,
          lessonId: {
            in: lessonIds,
          },
          isCompleted: true,
        },
      });

      const completedLessonIds = completedProgress.map(
        (progress) => progress.lessonId,
      );

      const totalLessons = course.lessons.length;
      const completedLessons = completedLessonIds.length;

      const progressPercentage =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      response.json({
        success: true,
        data: {
          courseId,
          completedLessonIds,
          completedLessons,
          totalLessons,
          progressPercentage,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

progressRouter.post(
  "/lessons/:lessonId/toggle",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const lessonId = Number(request.params.lessonId);

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (Number.isNaN(lessonId)) {
        response.status(400).json({
          success: false,
          message: "Invalid lesson ID.",
        });

        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user) {
        response.status(404).json({
          success: false,
          message: "User not found.",
        });

        return;
      }

      if (user.role === "ADMIN") {
        response.status(403).json({
          success: false,
          message: "Admins cannot track student progress.",
        });

        return;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
        },
        include: {
          course: {
            include: {
              lessons: true,
            },
          },
        },
      });

      if (!lesson) {
        response.status(404).json({
          success: false,
          message: "Lesson not found.",
        });

        return;
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.courseId,
          },
        },
      });

      if (!enrollment) {
        response.status(403).json({
          success: false,
          message: "Please enroll in this course first.",
        });

        return;
      }

      const existingProgress = await prisma.progress.findUnique({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
      });

      const nextCompletedValue = !existingProgress?.isCompleted;

      await prisma.progress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        update: {
          isCompleted: nextCompletedValue,
          completedAt: nextCompletedValue ? new Date() : null,
        },
        create: {
          userId,
          lessonId,
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      const courseLessonIds = lesson.course.lessons.map(
        (courseLesson) => courseLesson.id,
      );

      const completedProgress = await prisma.progress.findMany({
        where: {
          userId,
          lessonId: {
            in: courseLessonIds,
          },
          isCompleted: true,
        },
      });

      const completedLessonIds = completedProgress.map(
        (progress) => progress.lessonId,
      );

      const totalLessons = courseLessonIds.length;
      const completedLessons = completedLessonIds.length;

      const progressPercentage =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      response.json({
        success: true,
        message: nextCompletedValue
          ? "Lesson marked as completed."
          : "Lesson marked as incomplete.",
        data: {
          courseId: lesson.courseId,
          lessonId,
          isCompleted: nextCompletedValue,
          completedLessonIds,
          completedLessons,
          totalLessons,
          progressPercentage,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default progressRouter;