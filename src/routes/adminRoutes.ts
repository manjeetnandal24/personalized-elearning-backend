import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const adminRouter = Router();

adminRouter.use(authenticateUser);
adminRouter.use(requireAdmin);

function getCourseInclude() {
  return {
    lessons: {
      orderBy: {
        position: "asc" as const,
      },
    },
    topics: {
      orderBy: {
        position: "asc" as const,
      },
      include: {
        lessons: {
          orderBy: {
            position: "asc" as const,
          },
        },
      },
    },
  };
}

adminRouter.get("/courses", async (_request: AuthenticatedRequest, response, next) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: getCourseInclude(),
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
});

adminRouter.post("/courses", async (request: AuthenticatedRequest, response, next) => {
  try {
    const { title, description, shortName, level, category, instructor } =
      request.body;

    const titleText = String(title || "").trim();
    const descriptionText = String(description || "").trim();
    const shortNameText = String(shortName || "").trim();
    const levelText = String(level || "").trim();
    const categoryText = String(category || "General").trim();
    const instructorText = String(instructor || "").trim();

    if (
      !titleText ||
      !descriptionText ||
      !shortNameText ||
      !levelText ||
      !categoryText ||
      !instructorText
    ) {
      response.status(400).json({
        success: false,
        message: "All course fields are required.",
      });

      return;
    }

    const course = await prisma.course.create({
      data: {
        title: titleText,
        description: descriptionText,
        shortName: shortNameText,
        level: levelText,
        category: categoryText,
        instructor: instructorText,
      },
      include: getCourseInclude(),
    });

    response.status(201).json({
      success: true,
      message: "Course created successfully.",
      data: {
        course,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch(
  "/courses/:courseId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);

      const { title, description, shortName, level, category, instructor } =
        request.body;

      const titleText = String(title || "").trim();
      const descriptionText = String(description || "").trim();
      const shortNameText = String(shortName || "").trim();
      const levelText = String(level || "").trim();
      const categoryText = String(category || "General").trim();
      const instructorText = String(instructor || "").trim();

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      if (
        !titleText ||
        !descriptionText ||
        !shortNameText ||
        !levelText ||
        !categoryText ||
        !instructorText
      ) {
        response.status(400).json({
          success: false,
          message: "All course fields are required.",
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

      const course = await prisma.course.update({
        where: {
          id: courseId,
        },
        data: {
          title: titleText,
          description: descriptionText,
          shortName: shortNameText,
          level: levelText,
          category: categoryText,
          instructor: instructorText,
        },
        include: getCourseInclude(),
      });

      response.json({
        success: true,
        message: "Course updated successfully.",
        data: {
          course,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.delete(
  "/courses/:courseId",
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
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      const lessons = await prisma.lesson.findMany({
        where: {
          courseId,
        },
        select: {
          id: true,
        },
      });

      const lessonIds = lessons.map((lesson) => lesson.id);

      const quizzes = await prisma.quiz.findMany({
        where: {
          courseId,
        },
        select: {
          id: true,
        },
      });

      const quizIds = quizzes.map((quiz) => quiz.id);

      await prisma.$transaction([
        prisma.progress.deleteMany({
          where: {
            lessonId: {
              in: lessonIds,
            },
          },
        }),

        prisma.quizAttempt.deleteMany({
          where: {
            quizId: {
              in: quizIds,
            },
          },
        }),

        prisma.quizQuestion.deleteMany({
          where: {
            quizId: {
              in: quizIds,
            },
          },
        }),

        prisma.quiz.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.certificate.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.certificateTemplate.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.enrollment.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.lesson.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.topic.deleteMany({
          where: {
            courseId,
          },
        }),

        prisma.course.delete({
          where: {
            id: courseId,
          },
        }),
      ]);

      response.json({
        success: true,
        message: "Course deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.post(
  "/courses/:courseId/topics",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);
      const { title, description } = request.body;

      const titleText = String(title || "").trim();
      const descriptionText = String(description || "").trim();

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      if (!titleText || !descriptionText) {
        response.status(400).json({
          success: false,
          message: "Topic title and description are required.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        include: {
          topics: true,
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      const nextPosition = course.topics.length + 1;

      const topic = await prisma.topic.create({
        data: {
          title: titleText,
          description: descriptionText,
          position: nextPosition,
          courseId,
        },
        include: {
          lessons: {
            orderBy: {
              position: "asc",
            },
          },
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

adminRouter.post(
  "/courses/:courseId/lessons",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);

      const { title, description, content, duration, topicId } = request.body;

      const titleText = String(title || "").trim();
      const descriptionText = String(description || "").trim();
      const contentText = String(content || "").trim();
      const durationText = String(duration || "").trim();

      const topicIdNumber =
        topicId === undefined || topicId === "" || topicId === null
          ? null
          : Number(topicId);

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      if (!titleText || !descriptionText || !durationText) {
        response.status(400).json({
          success: false,
          message: "Lesson title, description and duration are required.",
        });

        return;
      }

      if (topicIdNumber !== null && Number.isNaN(topicIdNumber)) {
        response.status(400).json({
          success: false,
          message: "Invalid topic ID.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
        include: {
          lessons: true,
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      if (topicIdNumber !== null) {
        const topic = await prisma.topic.findFirst({
          where: {
            id: topicIdNumber,
            courseId,
          },
        });

        if (!topic) {
          response.status(404).json({
            success: false,
            message: "Topic not found for this course.",
          });

          return;
        }
      }

      const nextPosition = course.lessons.length + 1;

      const lesson = await prisma.lesson.create({
        data: {
          title: titleText,
          description: descriptionText,
          content: contentText,
          duration: durationText,
          position: nextPosition,
          courseId,
          topicId: topicIdNumber,
        },
      });

      response.status(201).json({
        success: true,
        message: "Lesson added successfully.",
        data: {
          lesson,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.patch(
  "/lessons/:lessonId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const lessonId = Number(request.params.lessonId);

      const { title, description, content, duration, topicId } = request.body;

      const titleText = String(title || "").trim();
      const descriptionText = String(description || "").trim();
      const contentText = String(content || "").trim();
      const durationText = String(duration || "").trim();

      const topicIdNumber =
        topicId === undefined || topicId === "" || topicId === null
          ? null
          : Number(topicId);

      if (Number.isNaN(lessonId)) {
        response.status(400).json({
          success: false,
          message: "Invalid lesson ID.",
        });

        return;
      }

      if (!titleText || !descriptionText || !durationText) {
        response.status(400).json({
          success: false,
          message: "Lesson title, description and duration are required.",
        });

        return;
      }

      if (topicIdNumber !== null && Number.isNaN(topicIdNumber)) {
        response.status(400).json({
          success: false,
          message: "Invalid topic ID.",
        });

        return;
      }

      const existingLesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
        },
      });

      if (!existingLesson) {
        response.status(404).json({
          success: false,
          message: "Lesson not found.",
        });

        return;
      }

      if (topicIdNumber !== null) {
        const topic = await prisma.topic.findFirst({
          where: {
            id: topicIdNumber,
            courseId: existingLesson.courseId,
          },
        });

        if (!topic) {
          response.status(404).json({
            success: false,
            message: "Topic not found for this lesson course.",
          });

          return;
        }
      }

      const lesson = await prisma.lesson.update({
        where: {
          id: lessonId,
        },
        data: {
          title: titleText,
          description: descriptionText,
          content: contentText,
          duration: durationText,
          topicId: topicIdNumber,
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

adminRouter.delete(
  "/lessons/:lessonId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const lessonId = Number(request.params.lessonId);

      if (Number.isNaN(lessonId)) {
        response.status(400).json({
          success: false,
          message: "Invalid lesson ID.",
        });

        return;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
        },
      });

      if (!lesson) {
        response.status(404).json({
          success: false,
          message: "Lesson not found.",
        });

        return;
      }

      await prisma.$transaction([
        prisma.progress.deleteMany({
          where: {
            lessonId,
          },
        }),

        prisma.lesson.delete({
          where: {
            id: lessonId,
          },
        }),
      ]);

      response.json({
        success: true,
        message: "Lesson deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default adminRouter;