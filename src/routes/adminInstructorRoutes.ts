import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const adminInstructorRouter = Router();

adminInstructorRouter.use(authenticateUser);
adminInstructorRouter.use(requireAdmin);

function getNumberId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

adminInstructorRouter.get(
  "/",
  async (_request: AuthenticatedRequest, response, next) => {
    try {
      const instructors = await prisma.user.findMany({
        where: {
          role: "INSTRUCTOR",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          teachingCourses: {
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
                  userId: true,
                },
              },
              quizzes: {
                select: {
                  id: true,
                  attempts: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
              certificates: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      const students = await prisma.user.findMany({
        where: {
          role: "STUDENT",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      const courses = await prisma.course.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          instructorUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
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

      const formattedInstructors = instructors.map((instructor) => {
        const assignedCourses = instructor.teachingCourses.map((course) => {
          const quizAttemptsCount = course.quizzes.reduce(
            (total, quiz) => total + quiz.attempts.length,
            0,
          );

          return {
            id: course.id,
            shortName: course.shortName,
            title: course.title,
            description: course.description,
            level: course.level,
            category: course.category,
            lessonsCount: course.lessons.length,
            studentsCount: course.enrollments.length,
            quizzesCount: course.quizzes.length,
            quizAttemptsCount,
            certificatesCount: course.certificates.length,
          };
        });

        const uniqueStudentIds = new Set(
          instructor.teachingCourses.flatMap((course) =>
            course.enrollments.map((enrollment) => enrollment.userId),
          ),
        );

        const totalLessons = instructor.teachingCourses.reduce(
          (total, course) => total + course.lessons.length,
          0,
        );

        const totalQuizzes = instructor.teachingCourses.reduce(
          (total, course) => total + course.quizzes.length,
          0,
        );

        const totalQuizAttempts = instructor.teachingCourses.reduce(
          (total, course) =>
            total +
            course.quizzes.reduce(
              (quizTotal, quiz) => quizTotal + quiz.attempts.length,
              0,
            ),
          0,
        );

        const totalCertificates = instructor.teachingCourses.reduce(
          (total, course) => total + course.certificates.length,
          0,
        );

        return {
          id: instructor.id,
          name: instructor.name,
          email: instructor.email,
          role: instructor.role,
          joinedAt: instructor.createdAt,
          assignedCoursesCount: instructor.teachingCourses.length,
          uniqueStudentsCount: uniqueStudentIds.size,
          lessonsCount: totalLessons,
          quizzesCount: totalQuizzes,
          quizAttemptsCount: totalQuizAttempts,
          certificatesCount: totalCertificates,
          assignedCourses,
        };
      });

      const formattedCourses = courses.map((course) => ({
        id: course.id,
        shortName: course.shortName,
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category,
        instructor: course.instructor,
        instructorId: course.instructorId,
        instructorUser: course.instructorUser,
        lessonsCount: course.lessons.length,
        studentsCount: course.enrollments.length,
        quizzesCount: course.quizzes.length,
        certificatesCount: course.certificates.length,
      }));

      response.json({
        success: true,
        data: {
          stats: {
            instructorsCount: instructors.length,
            studentsAvailableToPromote: students.length,
            totalCourses: courses.length,
            assignedCourses: courses.filter((course) => course.instructorId)
              .length,
            unassignedCourses: courses.filter((course) => !course.instructorId)
              .length,
          },
          instructors: formattedInstructors,
          students,
          courses: formattedCourses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminInstructorRouter.patch(
  "/users/:userId/role",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = getNumberId(request.params.userId);
      const targetRole = String(request.body.role || "").trim().toUpperCase();

      if (!userId) {
        response.status(400).json({
          success: false,
          message: "Valid user is required.",
        });

        return;
      }

      if (!["STUDENT", "INSTRUCTOR"].includes(targetRole)) {
        response.status(400).json({
          success: false,
          message: "Role must be STUDENT or INSTRUCTOR.",
        });

        return;
      }

      if (request.user?.userId === userId) {
        response.status(400).json({
          success: false,
          message: "You cannot change your own role.",
        });

        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
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
        response.status(400).json({
          success: false,
          message: "Admin role cannot be changed from this page.",
        });

        return;
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          role: targetRole as "STUDENT" | "INSTRUCTOR",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (targetRole === "STUDENT") {
        await prisma.course.updateMany({
          where: {
            instructorId: userId,
          },
          data: {
            instructorId: null,
            instructor: "Unassigned",
          },
        });
      }

      response.json({
        success: true,
        message:
          targetRole === "INSTRUCTOR"
            ? "User promoted to instructor successfully."
            : "Instructor demoted to student successfully.",
        data: {
          user: updatedUser,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminInstructorRouter.patch(
  "/courses/:courseId/assign",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = getNumberId(request.params.courseId);
      const rawInstructorId = request.body.instructorId;

      if (!courseId) {
        response.status(400).json({
          success: false,
          message: "Valid course is required.",
        });

        return;
      }

      const existingCourse = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
      });

      if (!existingCourse) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      if (
        rawInstructorId === null ||
        rawInstructorId === undefined ||
        rawInstructorId === ""
      ) {
        const course = await prisma.course.update({
          where: {
            id: courseId,
          },
          data: {
            instructorId: null,
            instructor: "Unassigned",
          },
          include: {
            instructorUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

        response.json({
          success: true,
          message: "Instructor removed from course successfully.",
          data: {
            course,
          },
        });

        return;
      }

      const instructorId = Number(rawInstructorId);

      if (!Number.isInteger(instructorId) || instructorId <= 0) {
        response.status(400).json({
          success: false,
          message: "Valid instructor is required.",
        });

        return;
      }

      const instructor = await prisma.user.findFirst({
        where: {
          id: instructorId,
          role: "INSTRUCTOR",
        },
      });

      if (!instructor) {
        response.status(404).json({
          success: false,
          message: "Instructor not found. Promote the user first.",
        });

        return;
      }

      const course = await prisma.course.update({
        where: {
          id: courseId,
        },
        data: {
          instructorId,
          instructor: instructor.name,
        },
        include: {
          instructorUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      response.json({
        success: true,
        message: "Course assigned to instructor successfully.",
        data: {
          course,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default adminInstructorRouter;