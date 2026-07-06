import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const courseResourceRouter = Router();

courseResourceRouter.use(authenticateUser);

type CourseResourceTypeValue = "LINK" | "PDF" | "VIDEO" | "NOTE" | "OTHER";

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

function normalizeResourceType(value: unknown): CourseResourceTypeValue | null {
  const type = String(value || "").trim().toUpperCase();

  if (!["LINK", "PDF", "VIDEO", "NOTE", "OTHER"].includes(type)) {
    return null;
  }

  return type as CourseResourceTypeValue;
}

async function canManageCourse(courseId: number, userId: number, role: string) {
  if (role === "ADMIN") {
    return true;
  }

  if (role !== "INSTRUCTOR") {
    return false;
  }

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

courseResourceRouter.get(
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

      if (role === "ADMIN") {
        const courses = await prisma.course.findMany({
          orderBy: {
            createdAt: "desc",
          },
          include: {
            resources: {
              orderBy: {
                createdAt: "desc",
              },
              include: {
                createdBy: {
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
          data: {
            courses,
          },
        });

        return;
      }

      if (role === "INSTRUCTOR") {
        const courses = await prisma.course.findMany({
          where: {
            instructorId: userId,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            resources: {
              orderBy: {
                createdAt: "desc",
              },
              include: {
                createdBy: {
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
          data: {
            courses,
          },
        });

        return;
      }

      const enrollments = await prisma.enrollment.findMany({
        where: {
          userId,
        },
        select: {
          courseId: true,
        },
      });

      const enrolledCourseIds = enrollments.map(
        (enrollment) => enrollment.courseId,
      );

      const courses = await prisma.course.findMany({
        where: {
          id: {
            in: enrolledCourseIds,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          resources: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              createdBy: {
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
        data: {
          courses,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseResourceRouter.post(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;

      const courseId = Number(request.body.courseId);
      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();
      const resourceUrl = String(request.body.resourceUrl || "").trim();
      const type = normalizeResourceType(request.body.type);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (role === "STUDENT") {
        response.status(403).json({
          success: false,
          message: "Students cannot create resources.",
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

      if (!title || !resourceUrl) {
        response.status(400).json({
          success: false,
          message: "Resource title and URL are required.",
        });

        return;
      }

      if (!type) {
        response.status(400).json({
          success: false,
          message: "Valid resource type is required.",
        });

        return;
      }

      const hasAccess = await canManageCourse(courseId, userId, role);

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can add resources only to allowed courses.",
        });

        return;
      }

      const resource = await prisma.courseResource.create({
        data: {
          title,
          description,
          resourceUrl,
          type,
          courseId,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          course: {
            select: {
              id: true,
              shortName: true,
              title: true,
              category: true,
              level: true,
            },
          },
        },
      });

      response.status(201).json({
        success: true,
        message: "Resource created successfully.",
        data: {
          resource,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseResourceRouter.patch(
  "/:resourceId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const resourceId = getNumberId(request.params.resourceId);

      const title = String(request.body.title || "").trim();
      const description = String(request.body.description || "").trim();
      const resourceUrl = String(request.body.resourceUrl || "").trim();
      const type = normalizeResourceType(request.body.type);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!resourceId) {
        response.status(400).json({
          success: false,
          message: "Valid resource is required.",
        });

        return;
      }

      if (role === "STUDENT") {
        response.status(403).json({
          success: false,
          message: "Students cannot update resources.",
        });

        return;
      }

      if (!title || !resourceUrl) {
        response.status(400).json({
          success: false,
          message: "Resource title and URL are required.",
        });

        return;
      }

      if (!type) {
        response.status(400).json({
          success: false,
          message: "Valid resource type is required.",
        });

        return;
      }

      const existingResource = await prisma.courseResource.findUnique({
        where: {
          id: resourceId,
        },
        select: {
          id: true,
          courseId: true,
        },
      });

      if (!existingResource) {
        response.status(404).json({
          success: false,
          message: "Resource not found.",
        });

        return;
      }

      const hasAccess = await canManageCourse(
        existingResource.courseId,
        userId,
        role,
      );

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can update resources only for allowed courses.",
        });

        return;
      }

      const resource = await prisma.courseResource.update({
        where: {
          id: resourceId,
        },
        data: {
          title,
          description,
          resourceUrl,
          type,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          course: {
            select: {
              id: true,
              shortName: true,
              title: true,
              category: true,
              level: true,
            },
          },
        },
      });

      response.json({
        success: true,
        message: "Resource updated successfully.",
        data: {
          resource,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

courseResourceRouter.delete(
  "/:resourceId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const resourceId = getNumberId(request.params.resourceId);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!resourceId) {
        response.status(400).json({
          success: false,
          message: "Valid resource is required.",
        });

        return;
      }

      if (role === "STUDENT") {
        response.status(403).json({
          success: false,
          message: "Students cannot delete resources.",
        });

        return;
      }

      const existingResource = await prisma.courseResource.findUnique({
        where: {
          id: resourceId,
        },
        select: {
          id: true,
          courseId: true,
        },
      });

      if (!existingResource) {
        response.status(404).json({
          success: false,
          message: "Resource not found.",
        });

        return;
      }

      const hasAccess = await canManageCourse(
        existingResource.courseId,
        userId,
        role,
      );

      if (!hasAccess) {
        response.status(403).json({
          success: false,
          message: "You can delete resources only from allowed courses.",
        });

        return;
      }

      await prisma.courseResource.delete({
        where: {
          id: resourceId,
        },
      });

      response.json({
        success: true,
        message: "Resource deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default courseResourceRouter;