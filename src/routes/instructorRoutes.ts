import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireInstructor } from "../middleware/instructorMiddleware.js";
import { prisma } from "../lib/prisma.js";

const instructorRouter = Router();

instructorRouter.use(authenticateUser);
instructorRouter.use(requireInstructor);

instructorRouter.get(
  "/overview",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      const courses = await prisma.course.findMany({
        where: {
          instructorId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          lessons: {
            select: {
              id: true,
            },
          },
          enrollments: {
            select: {
              id: true,
            },
          },
          quizzes: {
            select: {
              id: true,
            },
          },
          certificates: {
            select: {
              id: true,
            },
          },
        },
      });

      const courseIds = courses.map((course) => course.id);

      const completedLessonsCount =
  courseIds.length === 0
    ? 0
    : await prisma.progress.count({
        where: {
          isCompleted: true,
          lesson: {
            courseId: {
              in: courseIds,
            },
          },
        },
      });
      const quizAttempts =
        courseIds.length === 0
          ? []
          : await prisma.quizAttempt.findMany({
              where: {
                quiz: {
                  courseId: {
                    in: courseIds,
                  },
                },
              },
              select: {
                id: true,
                score: true,
                passed: true,
              },
            });

      const totalLessons = courses.reduce(
        (total, course) => total + course.lessons.length,
        0,
      );

      const totalEnrollments = courses.reduce(
        (total, course) => total + course.enrollments.length,
        0,
      );

      const totalCertificates = courses.reduce(
        (total, course) => total + course.certificates.length,
        0,
      );

      const averageProgress =
        totalLessons === 0
          ? 0
          : Math.round((completedLessonsCount / totalLessons) * 100);

      const averageQuizScore =
        quizAttempts.length === 0
          ? 0
          : Math.round(
              quizAttempts.reduce(
                (total, attempt) => total + attempt.score,
                0,
              ) / quizAttempts.length,
            );

      const instructorCourses = courses.map((course) => ({
        id: course.id,
        shortName: course.shortName,
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category,
        lessonsCount: course.lessons.length,
        enrollmentsCount: course.enrollments.length,
        quizzesCount: course.quizzes.length,
        certificatesCount: course.certificates.length,
      }));

      response.json({
        success: true,
        data: {
          stats: {
            coursesCount: courses.length,
            studentsCount: totalEnrollments,
            quizAttemptsCount: quizAttempts.length,
            averageQuizScore,
            averageProgress,
            certificatesCount: totalCertificates,
          },
          courses: instructorCourses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.get(
  "/courses",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      const courses = await prisma.course.findMany({
        where: {
          instructorId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          lessons: {
            select: {
              id: true,
            },
          },
          enrollments: {
            select: {
              id: true,
            },
          },
          quizzes: {
            select: {
              id: true,
            },
          },
          certificates: {
            select: {
              id: true,
            },
          },
        },
      });

      const formattedCourses = courses.map((course) => ({
        id: course.id,
        shortName: course.shortName,
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category,
        instructor: course.instructor,
        lessonsCount: course.lessons.length,
        enrollmentsCount: course.enrollments.length,
        quizzesCount: course.quizzes.length,
        certificatesCount: course.certificates.length,
      }));

      response.json({
        success: true,
        data: {
          courses: formattedCourses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default instructorRouter;