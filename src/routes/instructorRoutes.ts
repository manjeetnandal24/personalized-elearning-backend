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

const totalPossibleLessonCompletions = courses.reduce(
  (total, course) =>
    total + course.lessons.length * course.enrollments.length,
  0,
);

const totalCertificates = courses.reduce(
  (total, course) => total + course.certificates.length,
  0,
);

const averageProgress =
  totalPossibleLessonCompletions === 0
    ? 0
    : Math.min(
        100,
        Math.round(
          (completedLessonsCount / totalPossibleLessonCompletions) * 100,
        ),
      );
      
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

async function checkInstructorCourseAccess(
  courseId: number,
  instructorId: number,
) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      instructorId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(course);
}

instructorRouter.get(
  "/curriculum",
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
          topics: {
            orderBy: {
              position: "asc",
            },
            include: {
              lessons: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
          lessons: {
            where: {
              topicId: null,
            },
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      response.json({
        success: true,
        data: {
          courses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.post(
  "/topics",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const courseId = Number(request.body.courseId);
      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!Number.isInteger(courseId) || courseId <= 0) {
        response.status(400).json({
          success: false,
          message: "Valid course is required.",
        });

        return;
      }

      if (!title) {
        response.status(400).json({
          success: false,
          message: "Topic title is required.",
        });

        return;
      }

      const hasAccess = await checkInstructorCourseAccess(courseId, instructorId);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can manage only your assigned courses.",
        });

        return;
      }

      const lastTopic = await prisma.topic.aggregate({
        where: {
          courseId,
        },
        _max: {
          position: true,
        },
      });

      const topic = await prisma.topic.create({
        data: {
          title,
          description,
          position: (lastTopic._max.position || 0) + 1,
          courseId,
        },
      });

      response.status(201).json({
        success: true,
        message: "Topic created successfully.",
        data: {
          topic,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.patch(
  "/topics/:topicId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const topicId = getNumberId(request.params.topicId);
      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!topicId) {
        response.status(400).json({
          success: false,
          message: "Valid topic is required.",
        });

        return;
      }

      if (!title) {
        response.status(400).json({
          success: false,
          message: "Topic title is required.",
        });

        return;
      }

      const existingTopic = await prisma.topic.findFirst({
        where: {
          id: topicId,
          course: {
            instructorId,
          },
        },
      });

      if (!existingTopic) {
        response.status(404).json({
          success: false,
          message: "Topic not found in your assigned courses.",
        });

        return;
      }

      const topic = await prisma.topic.update({
        where: {
          id: topicId,
        },
        data: {
          title,
          description,
        },
      });

      response.json({
        success: true,
        message: "Topic updated successfully.",
        data: {
          topic,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.delete(
  "/topics/:topicId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const topicId = getNumberId(request.params.topicId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!topicId) {
        response.status(400).json({
          success: false,
          message: "Valid topic is required.",
        });

        return;
      }

      const existingTopic = await prisma.topic.findFirst({
        where: {
          id: topicId,
          course: {
            instructorId,
          },
        },
      });

      if (!existingTopic) {
        response.status(404).json({
          success: false,
          message: "Topic not found in your assigned courses.",
        });

        return;
      }

      await prisma.lesson.updateMany({
        where: {
          topicId,
        },
        data: {
          topicId: null,
        },
      });

      await prisma.topic.delete({
        where: {
          id: topicId,
        },
      });

      response.json({
        success: true,
        message: "Topic deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.post(
  "/lessons",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const courseId = Number(request.body.courseId);
      const rawTopicId = request.body.topicId;
      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();
      const content = String(request.body.content || "").trim();
      const duration = String(request.body.duration || "").trim();

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!Number.isInteger(courseId) || courseId <= 0) {
        response.status(400).json({
          success: false,
          message: "Valid course is required.",
        });

        return;
      }

      if (!title || !description || !duration) {
        response.status(400).json({
          success: false,
          message: "Lesson title, description and duration are required.",
        });

        return;
      }

      const hasAccess = await checkInstructorCourseAccess(courseId, instructorId);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can manage only your assigned courses.",
        });

        return;
      }

      let topicId: number | null = null;

      if (rawTopicId !== undefined && rawTopicId !== null && rawTopicId !== "") {
        topicId = Number(rawTopicId);

        if (!Number.isInteger(topicId) || topicId <= 0) {
          response.status(400).json({
            success: false,
            message: "Valid topic is required.",
          });

          return;
        }

        const topic = await prisma.topic.findFirst({
          where: {
            id: topicId,
            courseId,
            course: {
              instructorId,
            },
          },
        });

        if (!topic) {
          response.status(404).json({
            success: false,
            message: "Topic not found in your assigned course.",
          });

          return;
        }
      }

      const lastLesson = await prisma.lesson.aggregate({
        where: {
          courseId,
        },
        _max: {
          position: true,
        },
      });

      const lesson = await prisma.lesson.create({
        data: {
          title,
          description,
          content,
          duration,
          position: (lastLesson._max.position || 0) + 1,
          courseId,
          topicId,
        },
      });

      response.status(201).json({
        success: true,
        message: "Lesson created successfully.",
        data: {
          lesson,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.patch(
  "/lessons/:lessonId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const lessonId = getNumberId(request.params.lessonId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!lessonId) {
        response.status(400).json({
          success: false,
          message: "Valid lesson is required.",
        });

        return;
      }

      const existingLesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          course: {
            instructorId,
          },
        },
      });

      if (!existingLesson) {
        response.status(404).json({
          success: false,
          message: "Lesson not found in your assigned courses.",
        });

        return;
      }

      const title =
        request.body.title === undefined
          ? existingLesson.title
          : String(request.body.title || "").trim();

      const description =
        request.body.description === undefined
          ? existingLesson.description
          : String(request.body.description || "").trim();

      const content =
        request.body.content === undefined
          ? existingLesson.content
          : String(request.body.content || "").trim();

      const duration =
        request.body.duration === undefined
          ? existingLesson.duration
          : String(request.body.duration || "").trim();

      if (!title || !description || !duration) {
        response.status(400).json({
          success: false,
          message: "Lesson title, description and duration are required.",
        });

        return;
      }

      let topicId = existingLesson.topicId;

      if (Object.prototype.hasOwnProperty.call(request.body, "topicId")) {
        const rawTopicId = request.body.topicId;

        if (rawTopicId === null || rawTopicId === "") {
          topicId = null;
        } else {
          const parsedTopicId = Number(rawTopicId);

          if (!Number.isInteger(parsedTopicId) || parsedTopicId <= 0) {
            response.status(400).json({
              success: false,
              message: "Valid topic is required.",
            });

            return;
          }

          const topic = await prisma.topic.findFirst({
            where: {
              id: parsedTopicId,
              courseId: existingLesson.courseId,
              course: {
                instructorId,
              },
            },
          });

          if (!topic) {
            response.status(404).json({
              success: false,
              message: "Topic not found in your assigned course.",
            });

            return;
          }

          topicId = parsedTopicId;
        }
      }

      const lesson = await prisma.lesson.update({
        where: {
          id: lessonId,
        },
        data: {
          title,
          description,
          content,
          duration,
          topicId,
        },
      });

      response.json({
        success: true,
        message: "Lesson updated successfully.",
        data: {
          lesson,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.delete(
  "/lessons/:lessonId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const lessonId = getNumberId(request.params.lessonId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!lessonId) {
        response.status(400).json({
          success: false,
          message: "Valid lesson is required.",
        });

        return;
      }

      const existingLesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          course: {
            instructorId,
          },
        },
      });

      if (!existingLesson) {
        response.status(404).json({
          success: false,
          message: "Lesson not found in your assigned courses.",
        });

        return;
      }

      await prisma.lesson.delete({
        where: {
          id: lessonId,
        },
      });

      response.json({
        success: true,
        message: "Lesson deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.get(
  "/students",
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
            orderBy: {
              enrolledAt: "desc",
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      const courseIds = courses.map((course) => course.id);
      const lessonIds = courses.flatMap((course) =>
        course.lessons.map((lesson) => lesson.id),
      );

      const studentIds = Array.from(
        new Set(
          courses.flatMap((course) =>
            course.enrollments.map((enrollment) => enrollment.userId),
          ),
        ),
      );

      const completedProgress =
        studentIds.length === 0 || lessonIds.length === 0
          ? []
          : await prisma.progress.findMany({
              where: {
                userId: {
                  in: studentIds,
                },
                lessonId: {
                  in: lessonIds,
                },
                isCompleted: true,
              },
              select: {
                userId: true,
                lessonId: true,
              },
            });

      const quizAttempts =
        studentIds.length === 0 || courseIds.length === 0
          ? []
          : await prisma.quizAttempt.findMany({
              where: {
                userId: {
                  in: studentIds,
                },
                quiz: {
                  courseId: {
                    in: courseIds,
                  },
                },
              },
              select: {
                id: true,
                userId: true,
                score: true,
                passed: true,
                createdAt: true,
                quiz: {
                  select: {
                    courseId: true,
                    title: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            });

      const certificates =
        studentIds.length === 0 || courseIds.length === 0
          ? []
          : await prisma.certificate.findMany({
              where: {
                userId: {
                  in: studentIds,
                },
                courseId: {
                  in: courseIds,
                },
              },
              select: {
                id: true,
                userId: true,
                courseId: true,
                certificateCode: true,
                issuedAt: true,
              },
            });

      const courseStudentGroups = courses.map((course) => {
        const courseLessonIds = new Set(
          course.lessons.map((lesson) => lesson.id),
        );

        const students = course.enrollments.map((enrollment) => {
          const studentCompletedLessons = completedProgress.filter(
            (progress) =>
              progress.userId === enrollment.userId &&
              courseLessonIds.has(progress.lessonId),
          ).length;

          const studentQuizAttempts = quizAttempts.filter(
            (attempt) =>
              attempt.userId === enrollment.userId &&
              attempt.quiz.courseId === course.id,
          );

          const passedQuizAttempts = studentQuizAttempts.filter(
            (attempt) => attempt.passed,
          ).length;

          const averageQuizScore =
            studentQuizAttempts.length === 0
              ? 0
              : Math.round(
                  studentQuizAttempts.reduce(
                    (total, attempt) => total + attempt.score,
                    0,
                  ) / studentQuizAttempts.length,
                );

          const certificate = certificates.find(
            (item) =>
              item.userId === enrollment.userId && item.courseId === course.id,
          );

          const progressPercentage =
            course.lessons.length === 0
              ? 0
              : Math.round(
                  (studentCompletedLessons / course.lessons.length) * 100,
                );

          return {
            id: enrollment.user.id,
            name: enrollment.user.name,
            email: enrollment.user.email,
            joinedAt: enrollment.user.createdAt,
            enrolledAt: enrollment.enrolledAt,
            completedLessons: studentCompletedLessons,
            totalLessons: course.lessons.length,
            progressPercentage,
            quizAttempts: studentQuizAttempts.length,
            passedQuizAttempts,
            averageQuizScore,
            certificateEarned: Boolean(certificate),
            certificate,
          };
        });

        return {
          courseId: course.id,
          courseTitle: course.title,
          courseShortName: course.shortName,
          courseLevel: course.level,
          courseCategory: course.category,
          totalLessons: course.lessons.length,
          students,
        };
      });

      const allEnrollmentProgress = courseStudentGroups.flatMap((course) =>
        course.students.map((student) => student.progressPercentage),
      );

      const averageProgress =
        allEnrollmentProgress.length === 0
          ? 0
          : Math.round(
              allEnrollmentProgress.reduce(
                (total, progress) => total + progress,
                0,
              ) / allEnrollmentProgress.length,
            );

      response.json({
        success: true,
        data: {
          stats: {
            assignedCourses: courses.length,
            uniqueStudents: studentIds.length,
            totalEnrollments: courses.reduce(
              (total, course) => total + course.enrollments.length,
              0,
            ),
            quizAttempts: quizAttempts.length,
            certificates: certificates.length,
            averageProgress,
          },
          courses: courseStudentGroups,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

function normalizeCorrectOption(value: unknown) {
  const option = String(value || "").trim().toUpperCase();

  if (!["A", "B", "C", "D"].includes(option)) {
    return null;
  }

  return option;
}

async function checkInstructorQuizAccess(quizId: number, instructorId: number) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      course: {
        instructorId,
      },
    },
    select: {
      id: true,
      courseId: true,
    },
  });

  return quiz;
}

instructorRouter.get(
  "/quizzes",
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
          topics: {
            orderBy: {
              position: "asc",
            },
            select: {
              id: true,
              title: true,
              courseId: true,
            },
          },
          quizzes: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              topic: {
                select: {
                  id: true,
                  title: true,
                },
              },
              questions: {
                orderBy: {
                  position: "asc",
                },
              },
              attempts: {
                select: {
                  id: true,
                  score: true,
                  passed: true,
                },
              },
            },
          },
        },
      });

      response.json({
        success: true,
        data: {
          courses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.post(
  "/quizzes",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const courseId = Number(request.body.courseId);
      const rawTopicId = request.body.topicId;
      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();
      const passingScore = Number(request.body.passingScore || 60);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!Number.isInteger(courseId) || courseId <= 0) {
        response.status(400).json({
          success: false,
          message: "Valid course is required.",
        });

        return;
      }

      if (!title || !description) {
        response.status(400).json({
          success: false,
          message: "Quiz title and description are required.",
        });

        return;
      }

      if (
        !Number.isInteger(passingScore) ||
        passingScore < 0 ||
        passingScore > 100
      ) {
        response.status(400).json({
          success: false,
          message: "Passing score must be between 0 and 100.",
        });

        return;
      }

      const hasAccess = await checkInstructorCourseAccess(courseId, instructorId);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can manage quizzes only for your assigned courses.",
        });

        return;
      }

      let topicId: number | null = null;

      if (rawTopicId !== undefined && rawTopicId !== null && rawTopicId !== "") {
        topicId = Number(rawTopicId);

        if (!Number.isInteger(topicId) || topicId <= 0) {
          response.status(400).json({
            success: false,
            message: "Valid topic is required.",
          });

          return;
        }

        const topic = await prisma.topic.findFirst({
          where: {
            id: topicId,
            courseId,
            course: {
              instructorId,
            },
          },
        });

        if (!topic) {
          response.status(404).json({
            success: false,
            message: "Topic not found in your assigned course.",
          });

          return;
        }
      }

      const quiz = await prisma.quiz.create({
        data: {
          title,
          description,
          passingScore,
          courseId,
          topicId,
        },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
          questions: true,
          attempts: true,
        },
      });

      response.status(201).json({
        success: true,
        message: "Quiz created successfully.",
        data: {
          quiz,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.patch(
  "/quizzes/:quizId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const quizId = getNumberId(request.params.quizId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!quizId) {
        response.status(400).json({
          success: false,
          message: "Valid quiz is required.",
        });

        return;
      }

      const existingQuiz = await prisma.quiz.findFirst({
        where: {
          id: quizId,
          course: {
            instructorId,
          },
        },
      });

      if (!existingQuiz) {
        response.status(404).json({
          success: false,
          message: "Quiz not found in your assigned courses.",
        });

        return;
      }

      const title =
        request.body.title === undefined
          ? existingQuiz.title
          : String(request.body.title || "").trim();

      const description =
        request.body.description === undefined
          ? existingQuiz.description
          : String(request.body.description || "").trim();

      const passingScore =
        request.body.passingScore === undefined
          ? existingQuiz.passingScore
          : Number(request.body.passingScore);

      if (!title || !description) {
        response.status(400).json({
          success: false,
          message: "Quiz title and description are required.",
        });

        return;
      }

      if (
        !Number.isInteger(passingScore) ||
        passingScore < 0 ||
        passingScore > 100
      ) {
        response.status(400).json({
          success: false,
          message: "Passing score must be between 0 and 100.",
        });

        return;
      }

      let topicId = existingQuiz.topicId;

      if (Object.prototype.hasOwnProperty.call(request.body, "topicId")) {
        const rawTopicId = request.body.topicId;

        if (rawTopicId === null || rawTopicId === "") {
          topicId = null;
        } else {
          const parsedTopicId = Number(rawTopicId);

          if (!Number.isInteger(parsedTopicId) || parsedTopicId <= 0) {
            response.status(400).json({
              success: false,
              message: "Valid topic is required.",
            });

            return;
          }

          const topic = await prisma.topic.findFirst({
            where: {
              id: parsedTopicId,
              courseId: existingQuiz.courseId,
              course: {
                instructorId,
              },
            },
          });

          if (!topic) {
            response.status(404).json({
              success: false,
              message: "Topic not found in your assigned course.",
            });

            return;
          }

          topicId = parsedTopicId;
        }
      }

      const quiz = await prisma.quiz.update({
        where: {
          id: quizId,
        },
        data: {
          title,
          description,
          passingScore,
          topicId,
        },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
          questions: {
            orderBy: {
              position: "asc",
            },
          },
          attempts: {
            select: {
              id: true,
              score: true,
              passed: true,
            },
          },
        },
      });

      response.json({
        success: true,
        message: "Quiz updated successfully.",
        data: {
          quiz,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.delete(
  "/quizzes/:quizId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const quizId = getNumberId(request.params.quizId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!quizId) {
        response.status(400).json({
          success: false,
          message: "Valid quiz is required.",
        });

        return;
      }

      const existingQuiz = await checkInstructorQuizAccess(quizId, instructorId);

      if (!existingQuiz) {
        response.status(404).json({
          success: false,
          message: "Quiz not found in your assigned courses.",
        });

        return;
      }

      await prisma.$transaction([
        prisma.quizAttempt.deleteMany({
          where: {
            quizId,
          },
        }),
        prisma.quizQuestion.deleteMany({
          where: {
            quizId,
          },
        }),
        prisma.quiz.delete({
          where: {
            id: quizId,
          },
        }),
      ]);

      response.json({
        success: true,
        message: "Quiz deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.post(
  "/quiz-questions",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const quizId = Number(request.body.quizId);
      const question = String(request.body.question || "").trim();
      const optionA = String(request.body.optionA || "").trim();
      const optionB = String(request.body.optionB || "").trim();
      const optionC = String(request.body.optionC || "").trim();
      const optionD = String(request.body.optionD || "").trim();
      const correctOption = normalizeCorrectOption(request.body.correctOption);
      const explanation = String(request.body.explanation || "").trim();
      const points = Number(request.body.points || 1);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!Number.isInteger(quizId) || quizId <= 0) {
        response.status(400).json({
          success: false,
          message: "Valid quiz is required.",
        });

        return;
      }

      const existingQuiz = await checkInstructorQuizAccess(quizId, instructorId);

      if (!existingQuiz) {
        response.status(404).json({
          success: false,
          message: "Quiz not found in your assigned courses.",
        });

        return;
      }

      if (!question || !optionA || !optionB || !optionC || !optionD) {
        response.status(400).json({
          success: false,
          message: "Question and all four options are required.",
        });

        return;
      }

      if (!correctOption) {
        response.status(400).json({
          success: false,
          message: "Correct option must be A, B, C or D.",
        });

        return;
      }

      if (!Number.isInteger(points) || points <= 0) {
        response.status(400).json({
          success: false,
          message: "Points must be a positive number.",
        });

        return;
      }

      const lastQuestion = await prisma.quizQuestion.aggregate({
        where: {
          quizId,
        },
        _max: {
          position: true,
        },
      });

      const createdQuestion = await prisma.quizQuestion.create({
        data: {
          question,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          explanation,
          points,
          position: (lastQuestion._max.position || 0) + 1,
          quizId,
        },
      });

      response.status(201).json({
        success: true,
        message: "Question created successfully.",
        data: {
          question: createdQuestion,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.patch(
  "/quiz-questions/:questionId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const questionId = getNumberId(request.params.questionId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!questionId) {
        response.status(400).json({
          success: false,
          message: "Valid question is required.",
        });

        return;
      }

      const existingQuestion = await prisma.quizQuestion.findFirst({
        where: {
          id: questionId,
          quiz: {
            course: {
              instructorId,
            },
          },
        },
      });

      if (!existingQuestion) {
        response.status(404).json({
          success: false,
          message: "Question not found in your assigned course quizzes.",
        });

        return;
      }

      const question =
        request.body.question === undefined
          ? existingQuestion.question
          : String(request.body.question || "").trim();

      const optionA =
        request.body.optionA === undefined
          ? existingQuestion.optionA
          : String(request.body.optionA || "").trim();

      const optionB =
        request.body.optionB === undefined
          ? existingQuestion.optionB
          : String(request.body.optionB || "").trim();

      const optionC =
        request.body.optionC === undefined
          ? existingQuestion.optionC
          : String(request.body.optionC || "").trim();

      const optionD =
        request.body.optionD === undefined
          ? existingQuestion.optionD
          : String(request.body.optionD || "").trim();

      const correctOption =
        request.body.correctOption === undefined
          ? existingQuestion.correctOption
          : normalizeCorrectOption(request.body.correctOption);

      const explanation =
        request.body.explanation === undefined
          ? existingQuestion.explanation
          : String(request.body.explanation || "").trim();

      const points =
        request.body.points === undefined
          ? existingQuestion.points
          : Number(request.body.points);

      if (!question || !optionA || !optionB || !optionC || !optionD) {
        response.status(400).json({
          success: false,
          message: "Question and all four options are required.",
        });

        return;
      }

      if (!correctOption) {
        response.status(400).json({
          success: false,
          message: "Correct option must be A, B, C or D.",
        });

        return;
      }

      if (!Number.isInteger(points) || points <= 0) {
        response.status(400).json({
          success: false,
          message: "Points must be a positive number.",
        });

        return;
      }

      const updatedQuestion = await prisma.quizQuestion.update({
        where: {
          id: questionId,
        },
        data: {
          question,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          explanation,
          points,
        },
      });

      response.json({
        success: true,
        message: "Question updated successfully.",
        data: {
          question: updatedQuestion,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.delete(
  "/quiz-questions/:questionId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const instructorId = request.user?.userId;
      const questionId = getNumberId(request.params.questionId);

      if (!instructorId) {
        response.status(401).json({
          success: false,
          message: "Instructor is not authenticated.",
        });

        return;
      }

      if (!questionId) {
        response.status(400).json({
          success: false,
          message: "Valid question is required.",
        });

        return;
      }

      const existingQuestion = await prisma.quizQuestion.findFirst({
        where: {
          id: questionId,
          quiz: {
            course: {
              instructorId,
            },
          },
        },
      });

      if (!existingQuestion) {
        response.status(404).json({
          success: false,
          message: "Question not found in your assigned course quizzes.",
        });

        return;
      }

      await prisma.quizQuestion.delete({
        where: {
          id: questionId,
        },
      });

      response.json({
        success: true,
        message: "Question deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

instructorRouter.get(
  "/analytics",
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
              userId: true,
              enrolledAt: true,
            },
          },
          quizzes: {
            select: {
              id: true,
              title: true,
              attempts: {
                select: {
                  id: true,
                  userId: true,
                  score: true,
                  passed: true,
                },
              },
            },
          },
          certificates: {
            select: {
              id: true,
              userId: true,
              courseId: true,
              certificateCode: true,
              issuedAt: true,
            },
          },
        },
      });

      const lessonIds = courses.flatMap((course) =>
        course.lessons.map((lesson) => lesson.id),
      );

      const studentIds = Array.from(
        new Set(
          courses.flatMap((course) =>
            course.enrollments.map((enrollment) => enrollment.userId),
          ),
        ),
      );

      const completedProgress =
        lessonIds.length === 0 || studentIds.length === 0
          ? []
          : await prisma.progress.findMany({
              where: {
                lessonId: {
                  in: lessonIds,
                },
                userId: {
                  in: studentIds,
                },
                isCompleted: true,
              },
              select: {
                userId: true,
                lessonId: true,
              },
            });

      const courseAnalytics = courses.map((course) => {
        const courseLessonIds = new Set(
          course.lessons.map((lesson) => lesson.id),
        );

        const courseQuizAttempts = course.quizzes.flatMap(
          (quiz) => quiz.attempts,
        );

        const completedLessonsForCourse = completedProgress.filter((progress) =>
          courseLessonIds.has(progress.lessonId),
        ).length;

        const totalPossibleCompletions =
          course.lessons.length * course.enrollments.length;

        const averageProgress =
          totalPossibleCompletions === 0
            ? 0
            : Math.round(
                (completedLessonsForCourse / totalPossibleCompletions) * 100,
              );

        const averageQuizScore =
          courseQuizAttempts.length === 0
            ? 0
            : Math.round(
                courseQuizAttempts.reduce(
                  (total, attempt) => total + attempt.score,
                  0,
                ) / courseQuizAttempts.length,
              );

        const passedAttempts = courseQuizAttempts.filter(
          (attempt) => attempt.passed,
        ).length;

        const passRate =
          courseQuizAttempts.length === 0
            ? 0
            : Math.round((passedAttempts / courseQuizAttempts.length) * 100);

        return {
          courseId: course.id,
          courseTitle: course.title,
          courseShortName: course.shortName,
          courseLevel: course.level,
          courseCategory: course.category,
          studentsCount: course.enrollments.length,
          lessonsCount: course.lessons.length,
          quizzesCount: course.quizzes.length,
          quizAttemptsCount: courseQuizAttempts.length,
          averageQuizScore,
          passRate,
          averageProgress,
          certificatesCount: course.certificates.length,
        };
      });

      const totalEnrollments = courses.reduce(
        (total, course) => total + course.enrollments.length,
        0,
      );

      const totalLessons = courses.reduce(
        (total, course) => total + course.lessons.length,
        0,
      );

      const allQuizAttempts = courses.flatMap((course) =>
        course.quizzes.flatMap((quiz) => quiz.attempts),
      );

      const totalCertificates = courses.reduce(
        (total, course) => total + course.certificates.length,
        0,
      );

      const averageQuizScore =
        allQuizAttempts.length === 0
          ? 0
          : Math.round(
              allQuizAttempts.reduce(
                (total, attempt) => total + attempt.score,
                0,
              ) / allQuizAttempts.length,
            );

      const passedAttempts = allQuizAttempts.filter(
        (attempt) => attempt.passed,
      ).length;

      const overallPassRate =
        allQuizAttempts.length === 0
          ? 0
          : Math.round((passedAttempts / allQuizAttempts.length) * 100);

      const averageProgress =
        courseAnalytics.length === 0
          ? 0
          : Math.round(
              courseAnalytics.reduce(
                (total, course) => total + course.averageProgress,
                0,
              ) / courseAnalytics.length,
            );

      const topProgressCourses = [...courseAnalytics]
        .sort((firstCourse, secondCourse) => {
          return secondCourse.averageProgress - firstCourse.averageProgress;
        })
        .slice(0, 5);

      const topQuizCourses = [...courseAnalytics]
        .sort((firstCourse, secondCourse) => {
          return secondCourse.averageQuizScore - firstCourse.averageQuizScore;
        })
        .slice(0, 5);

      response.json({
        success: true,
        data: {
          stats: {
            assignedCourses: courses.length,
            uniqueStudents: studentIds.length,
            totalEnrollments,
            totalLessons,
            quizAttempts: allQuizAttempts.length,
            averageQuizScore,
            passRate: overallPassRate,
            averageProgress,
            certificates: totalCertificates,
          },
          courseAnalytics,
          topProgressCourses,
          topQuizCourses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default instructorRouter;