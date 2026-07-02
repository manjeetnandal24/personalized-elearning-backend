import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const adminStudentRouter = Router();

adminStudentRouter.get(
  "/",
  authenticateUser,
  requireAdmin,
  async (_request: AuthenticatedRequest, response, next) => {
    try {
      const students = await prisma.user.findMany({
        where: {
          role: "STUDENT",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          enrollments: {
            orderBy: {
              enrolledAt: "desc",
            },
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  shortName: true,
                  level: true,
                  category: true,
                  lessons: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
          progress: {
            where: {
              isCompleted: true,
            },
            select: {
              lessonId: true,
            },
          },
          quizAttempts: {
            select: {
              id: true,
              score: true,
              passed: true,
            },
          },
          certificates: {
            select: {
              id: true,
              courseId: true,
              certificateCode: true,
              issuedAt: true,
            },
          },
        },
      });

      const studentAnalytics = students.map((student) => {
        const completedLessonIds = new Set(
          student.progress.map((progress) => progress.lessonId),
        );

        const enrolledCourses = student.enrollments.map((enrollment) => {
          const totalLessons = enrollment.course.lessons.length;

          const completedLessons = enrollment.course.lessons.filter((lesson) =>
            completedLessonIds.has(lesson.id),
          ).length;

          const progressPercentage =
            totalLessons === 0
              ? 0
              : Math.round((completedLessons / totalLessons) * 100);

          return {
            enrollmentId: enrollment.id,
            enrolledAt: enrollment.enrolledAt,
            courseId: enrollment.course.id,
            courseTitle: enrollment.course.title,
            courseShortName: enrollment.course.shortName,
            courseLevel: enrollment.course.level,
            courseCategory: enrollment.course.category,
            totalLessons,
            completedLessons,
            progressPercentage,
          };
        });

        const quizAttempts = student.quizAttempts.length;

        const passedQuizAttempts = student.quizAttempts.filter(
          (attempt) => attempt.passed,
        ).length;

        const averageQuizScore =
          quizAttempts === 0
            ? 0
            : Math.round(
                student.quizAttempts.reduce(
                  (total, attempt) => total + attempt.score,
                  0,
                ) / quizAttempts,
              );

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          joinedAt: student.createdAt,
          enrolledCoursesCount: student.enrollments.length,
          completedLessonsCount: student.progress.length,
          quizAttempts,
          passedQuizAttempts,
          averageQuizScore,
          certificatesCount: student.certificates.length,
          certificates: student.certificates,
          enrolledCourses,
        };
      });

      response.json({
        success: true,
        data: {
          students: studentAnalytics,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default adminStudentRouter;