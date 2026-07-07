import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const courseDiscussionRouter = Router();

courseDiscussionRouter.use(authenticateUser);

type DiscussionStatusValue = "OPEN" | "RESOLVED";

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

function normalizeDiscussionStatus(value: unknown): DiscussionStatusValue | null {
  const status = String(value || "").trim().toUpperCase();

  if (!["OPEN", "RESOLVED"].includes(status)) {
    return null;
  }

  return status as DiscussionStatusValue;
}

async function canAccessCourse(courseId: number, userId: number, role: string) {
  if (role === "ADMIN") {
    return true;
  }

  if (role === "INSTRUCTOR") {
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        instructorId: userId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(course);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(enrollment);
}

async function getAccessibleCourseIds(userId: number, role: string) {
  if (role === "ADMIN") {
    const courses = await prisma.course.findMany({
      select: {
        id: true,
      },
    });

    return courses.map((course) => course.id);
  }

  if (role === "INSTRUCTOR") {
    const courses = await prisma.course.findMany({
      where: {
        instructorId: userId,
      },
      select: {
        id: true,
      },
    });

    return courses.map((course) => course.id);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId,
    },
    select: {
      courseId: true,
    },
  });

  return enrollments.map((enrollment) => enrollment.courseId);
}

courseDiscussionRouter.get(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      const accessibleCourseIds = await getAccessibleCourseIds(userId, role);

      const courses = await prisma.course.findMany({
        where: {
          id: {
            in: accessibleCourseIds,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          discussions: {
            orderBy: {
              updatedAt: "desc",
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              replies: {
                orderBy: {
                  createdAt: "asc",
                },
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
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

courseDiscussionRouter.post(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;

      const courseId = Number(request.body.courseId);
      const title = String(request.body.title || "").trim();
      const message = String(request.body.message || "").trim();

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
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

      if (!title || !message) {
        response.status(400).json({
          success: false,
          message: "Discussion title and message are required.",
        });

        return;
      }

      const hasAccess = await canAccessCourse(courseId, userId, role);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can discuss only in allowed courses.",
        });

        return;
      }

      const discussion = await prisma.courseDiscussion.create({
        data: {
          title,
          message,
          courseId,
          authorId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      response.status(201).json({
        success: true,
        message: "Discussion created successfully.",
        data: {
          discussion,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseDiscussionRouter.post(
  "/:discussionId/replies",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const discussionId = getNumberId(request.params.discussionId);
      const message = String(request.body.message || "").trim();

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!discussionId) {
        response.status(400).json({
          success: false,
          message: "Valid discussion is required.",
        });

        return;
      }

      if (!message) {
        response.status(400).json({
          success: false,
          message: "Reply message is required.",
        });

        return;
      }

      const discussion = await prisma.courseDiscussion.findUnique({
        where: {
          id: discussionId,
        },
        select: {
          id: true,
          courseId: true,
        },
      });

      if (!discussion) {
        response.status(404).json({
          success: false,
          message: "Discussion not found.",
        });

        return;
      }

      const hasAccess = await canAccessCourse(discussion.courseId, userId, role);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can reply only in allowed course discussions.",
        });

        return;
      }

      const reply = await prisma.courseDiscussionReply.create({
        data: {
          message,
          discussionId,
          authorId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      await prisma.courseDiscussion.update({
        where: {
          id: discussionId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      response.status(201).json({
        success: true,
        message: "Reply added successfully.",
        data: {
          reply,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseDiscussionRouter.patch(
  "/:discussionId/status",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const discussionId = getNumberId(request.params.discussionId);
      const status = normalizeDiscussionStatus(request.body.status);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!discussionId) {
        response.status(400).json({
          success: false,
          message: "Valid discussion is required.",
        });

        return;
      }

      if (!status) {
        response.status(400).json({
          success: false,
          message: "Valid status is required.",
        });

        return;
      }

      const discussion = await prisma.courseDiscussion.findUnique({
        where: {
          id: discussionId,
        },
        select: {
          id: true,
          courseId: true,
          authorId: true,
        },
      });

      if (!discussion) {
        response.status(404).json({
          success: false,
          message: "Discussion not found.",
        });

        return;
      }

      const hasAccess = await canAccessCourse(discussion.courseId, userId, role);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You cannot update this discussion.",
        });

        return;
      }

      if (role === "STUDENT" && discussion.authorId !== userId) {
        response.status(403).json({
          success: false,
          message: "Students can update only their own discussion status.",
        });

        return;
      }

      const updatedDiscussion = await prisma.courseDiscussion.update({
        where: {
          id: discussionId,
        },
        data: {
          status,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          replies: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      response.json({
        success: true,
        message: "Discussion status updated successfully.",
        data: {
          discussion: updatedDiscussion,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseDiscussionRouter.delete(
  "/:discussionId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const discussionId = getNumberId(request.params.discussionId);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!discussionId) {
        response.status(400).json({
          success: false,
          message: "Valid discussion is required.",
        });

        return;
      }

      const discussion = await prisma.courseDiscussion.findUnique({
        where: {
          id: discussionId,
        },
        select: {
          id: true,
          courseId: true,
          authorId: true,
        },
      });

      if (!discussion) {
        response.status(404).json({
          success: false,
          message: "Discussion not found.",
        });

        return;
      }

      const hasAccess = await canAccessCourse(discussion.courseId, userId, role);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You cannot delete this discussion.",
        });

        return;
      }

      if (role === "STUDENT" && discussion.authorId !== userId) {
        response.status(403).json({
          success: false,
          message: "Students can delete only their own discussions.",
        });

        return;
      }

      await prisma.courseDiscussion.delete({
        where: {
          id: discussionId,
        },
      });

      response.json({
        success: true,
        message: "Discussion deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

courseDiscussionRouter.delete(
  "/replies/:replyId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const replyId = getNumberId(request.params.replyId);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!replyId) {
        response.status(400).json({
          success: false,
          message: "Valid reply is required.",
        });

        return;
      }

      const reply = await prisma.courseDiscussionReply.findUnique({
        where: {
          id: replyId,
        },
        select: {
          id: true,
          authorId: true,
          discussion: {
            select: {
              courseId: true,
            },
          },
        },
      });

      if (!reply) {
        response.status(404).json({
          success: false,
          message: "Reply not found.",
        });

        return;
      }

      const hasAccess = await canAccessCourse(
        reply.discussion.courseId,
        userId,
        role,
      );

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You cannot delete this reply.",
        });

        return;
      }

      if (role === "STUDENT" && reply.authorId !== userId) {
        response.status(403).json({
          success: false,
          message: "Students can delete only their own replies.",
        });

        return;
      }

      await prisma.courseDiscussionReply.delete({
        where: {
          id: replyId,
        },
      });

      response.json({
        success: true,
        message: "Reply deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default courseDiscussionRouter;