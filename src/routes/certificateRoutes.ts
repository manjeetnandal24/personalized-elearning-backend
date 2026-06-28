import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const certificateRouter = Router();

function createCertificateCode(courseId: number, userId: number) {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();

  return `LT-${courseId}-${userId}-${timePart}-${randomPart}`;
}

/* =========================
   ADMIN CERTIFICATE TEMPLATE
========================= */

certificateRouter.get(
  "/admin/templates/courses/:courseId",
  authenticateUser,
  requireAdmin,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        include: {
          certificateTemplate: true,
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      response.json({
        success: true,
        data: {
          courseId: course.id,
          courseTitle: course.title,
          courseShortName: course.shortName,
          template: course.certificateTemplate,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

certificateRouter.put(
  "/admin/templates/courses/:courseId",
  authenticateUser,
  requireAdmin,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);

      const title = String(
        request.body.title || "Certificate of Completion",
      ).trim();

      const subtitle = String(
        request.body.subtitle || "This certificate is proudly presented to",
      ).trim();

      const bodyText = String(
        request.body.bodyText || "for successfully completing the course",
      ).trim();

      const footerText = String(
        request.body.footerText ||
          "Keep learning and growing with LearnTrack.",
      ).trim();

      const signatoryName = String(
        request.body.signatoryName || "Course Instructor",
      ).trim();

      const signatoryTitle = String(
        request.body.signatoryTitle || "Instructor",
      ).trim();

      const brandColor = String(request.body.brandColor || "#2563eb").trim();

      const isActive =
        request.body.isActive === undefined ? true : Boolean(request.body.isActive);

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      if (
        !title ||
        !subtitle ||
        !bodyText ||
        !footerText ||
        !signatoryName ||
        !signatoryTitle ||
        !brandColor
      ) {
        response.status(400).json({
          success: false,
          message: "All certificate template fields are required.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      const template = await prisma.certificateTemplate.upsert({
        where: {
          courseId,
        },
        update: {
          title,
          subtitle,
          bodyText,
          footerText,
          signatoryName,
          signatoryTitle,
          brandColor,
          isActive,
        },
        create: {
          courseId,
          title,
          subtitle,
          bodyText,
          footerText,
          signatoryName,
          signatoryTitle,
          brandColor,
          isActive,
        },
      });

      response.json({
        success: true,
        message: "Certificate template saved successfully.",
        data: {
          template,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/* =========================
   STUDENT CERTIFICATE STATUS
========================= */

certificateRouter.get(
  "/courses/:courseId/status",
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
          name: true,
          email: true,
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
          message: "Admins cannot receive student certificates.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        include: {
          lessons: {
            select: {
              id: true,
            },
          },
          quizzes: {
            select: {
              id: true,
              title: true,
              passingScore: true,
            },
          },
          certificateTemplate: true,
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

      const completedLessons = await prisma.progress.count({
        where: {
          userId,
          lessonId: {
            in: lessonIds,
          },
          isCompleted: true,
        },
      });

      const totalLessons = course.lessons.length;

      const lessonProgressPercentage =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      const quizResults = await Promise.all(
        course.quizzes.map(async (quiz) => {
          const bestAttempt = await prisma.quizAttempt.findFirst({
            where: {
              userId,
              quizId: quiz.id,
            },
            orderBy: {
              score: "desc",
            },
          });

          return {
            quizId: quiz.id,
            quizTitle: quiz.title,
            passingScore: quiz.passingScore,
            isPassed: Boolean(bestAttempt?.passed),
            bestScore: bestAttempt?.score ?? null,
          };
        }),
      );

      const totalQuizzes = course.quizzes.length;
      const passedQuizzes = quizResults.filter((quiz) => quiz.isPassed).length;

      const lessonsCompleted =
        totalLessons > 0 && completedLessons === totalLessons;

      const quizzesCompleted =
        totalQuizzes === 0 ? true : passedQuizzes === totalQuizzes;

      const hasActiveTemplate = Boolean(course.certificateTemplate?.isActive);

      const isEligible =
        lessonsCompleted && quizzesCompleted && hasActiveTemplate;

      let certificate = await prisma.certificate.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });

      if (isEligible && !certificate) {
        certificate = await prisma.certificate.create({
          data: {
            userId,
            courseId,
            certificateCode: createCertificateCode(courseId, userId),
          },
        });
      }

      response.json({
        success: true,
        data: {
          student: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          course: {
            id: course.id,
            title: course.title,
            shortName: course.shortName,
            instructor: course.instructor,
          },
          enrolledAt: enrollment.enrolledAt,
          isEligible,
          hasActiveTemplate,
          certificate,
          template: course.certificateTemplate,
          lessons: {
            totalLessons,
            completedLessons,
            lessonProgressPercentage,
            lessonsCompleted,
          },
          quizzes: {
            totalQuizzes,
            passedQuizzes,
            quizzesCompleted,
            quizResults,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default certificateRouter;