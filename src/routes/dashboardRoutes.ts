import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

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
              lessons: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
        },
      });

      const allLessonIds = enrollments.flatMap((enrollment) =>
        enrollment.course.lessons.map((lesson) => lesson.id),
      );

      const completedProgress = await prisma.progress.findMany({
        where: {
          userId,
          isCompleted: true,
          lessonId: {
            in: allLessonIds,
          },
        },
      });

      const completedLessonIdSet = new Set(
        completedProgress.map((progress) => progress.lessonId),
      );

      const dashboardCourses = enrollments.map((enrollment) => {
        const totalLessons = enrollment.course.lessons.length;

        const completedLessons = enrollment.course.lessons.filter((lesson) =>
          completedLessonIdSet.has(lesson.id),
        ).length;

        const progressPercentage =
          totalLessons === 0
            ? 0
            : Math.round((completedLessons / totalLessons) * 100);

        return {
          id: enrollment.course.id,
          title: enrollment.course.title,
          shortName: enrollment.course.shortName,
          level: enrollment.course.level,
          completedLessons,
          totalLessons,
          progressPercentage,
          enrolledAt: enrollment.enrolledAt,
        };
      });

      const totalLessons = allLessonIds.length;
      const completedLessons = completedProgress.length;

      const overallProgress =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      const continueLearning =
        dashboardCourses.find((course) => course.progressPercentage < 100) ||
        dashboardCourses[0] ||
        null;

      const quizAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              passingScore: true,
              courseId: true,
              topicId: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  shortName: true,
                },
              },
              topic: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      const totalQuizAttempts = quizAttempts.length;

      const passedQuizAttempts = quizAttempts.filter(
        (attempt) => attempt.passed,
      ).length;

      const failedQuizAttempts = totalQuizAttempts - passedQuizAttempts;

      const averageQuizScore =
        totalQuizAttempts === 0
          ? 0
          : Math.round(
              quizAttempts.reduce((total, attempt) => total + attempt.score, 0) /
                totalQuizAttempts,
            );

      const uniqueQuizIds = new Set(
        quizAttempts.map((attempt) => attempt.quizId),
      );

      const recentQuizAttempts = quizAttempts.slice(0, 5).map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quizId,
        quizTitle: attempt.quiz.title,
        courseId: attempt.quiz.course.id,
        courseTitle: attempt.quiz.course.title,
        courseShortName: attempt.quiz.course.shortName,
        topicTitle: attempt.quiz.topic?.title || null,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        passed: attempt.passed,
        createdAt: attempt.createdAt,
      }));

      response.json({
        success: true,
        data: {
          enrolledCourses: enrollments.length,
          completedLessons,
          totalLessons,
          overallProgress,
          continueLearning,
          courses: dashboardCourses,
          quizAnalytics: {
            totalAttempts: totalQuizAttempts,
            uniqueQuizzesAttempted: uniqueQuizIds.size,
            passedAttempts: passedQuizAttempts,
            failedAttempts: failedQuizAttempts,
            averageScore: averageQuizScore,
            recentAttempts: recentQuizAttempts,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default dashboardRouter;