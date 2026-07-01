import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const adminAnalyticsRouter = Router();

adminAnalyticsRouter.get(
  "/",
  authenticateUser,
  requireAdmin,
  async (_request: AuthenticatedRequest, response, next) => {
    try {
      const [
        totalStudents,
        totalCourses,
        totalEnrollments,
        totalCertificates,
        totalQuizAttempts,
        scoreStats,
        courses,
      ] = await Promise.all([
        prisma.user.count({
          where: {
            role: "STUDENT",
          },
        }),

        prisma.course.count(),

        prisma.enrollment.count(),

        prisma.certificate.count(),

        prisma.quizAttempt.count(),

        prisma.quizAttempt.aggregate({
          _avg: {
            score: true,
          },
        }),

        prisma.course.findMany({
          orderBy: {
            createdAt: "desc",
          },
          include: {
            _count: {
              select: {
                enrollments: true,
                certificates: true,
                lessons: true,
                topics: true,
                quizzes: true,
              },
            },
            quizzes: {
              select: {
                attempts: {
                  select: {
                    score: true,
                    passed: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const courseAnalytics = courses.map((course) => {
        const quizAttempts = course.quizzes.flatMap((quiz) => quiz.attempts);

        const quizAttemptCount = quizAttempts.length;

        const passedQuizAttempts = quizAttempts.filter(
          (attempt) => attempt.passed,
        ).length;

        const averageQuizScore =
          quizAttemptCount === 0
            ? 0
            : Math.round(
                quizAttempts.reduce(
                  (total, attempt) => total + attempt.score,
                  0,
                ) / quizAttemptCount,
              );

        return {
          id: course.id,
          title: course.title,
          shortName: course.shortName,
          level: course.level,
          instructor: course.instructor,
          enrollments: course._count.enrollments,
          certificatesIssued: course._count.certificates,
          lessons: course._count.lessons,
          topics: course._count.topics,
          quizzes: course._count.quizzes,
          quizAttempts: quizAttemptCount,
          passedQuizAttempts,
          averageQuizScore,
        };
      });

      const topEnrollmentCourse =
        [...courseAnalytics].sort(
          (firstCourse, secondCourse) =>
            secondCourse.enrollments - firstCourse.enrollments,
        )[0] || null;

      const topCertificateCourse =
        [...courseAnalytics].sort(
          (firstCourse, secondCourse) =>
            secondCourse.certificatesIssued - firstCourse.certificatesIssued,
        )[0] || null;

      const topQuizCourse =
        [...courseAnalytics].sort(
          (firstCourse, secondCourse) =>
            secondCourse.quizAttempts - firstCourse.quizAttempts,
        )[0] || null;

      response.json({
        success: true,
        data: {
          totals: {
            totalStudents,
            totalCourses,
            totalEnrollments,
            totalCertificates,
            totalQuizAttempts,
            averageQuizScore: Math.round(scoreStats._avg.score || 0),
          },
          highlights: {
            topEnrollmentCourse,
            topCertificateCourse,
            topQuizCourse,
          },
          courses: courseAnalytics,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default adminAnalyticsRouter;