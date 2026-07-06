import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const announcementRouter = Router();

announcementRouter.use(authenticateUser);

type AnnouncementTargetType = "ALL" | "STUDENTS" | "INSTRUCTORS" | "COURSE";

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

function normalizeTarget(value: unknown): AnnouncementTargetType | null {
  const target = String(value || "").trim().toUpperCase();

  if (!["ALL", "STUDENTS", "INSTRUCTORS", "COURSE"].includes(target)) {
    return null;
  }

  return target as AnnouncementTargetType;
}

async function getAssignedCourseIds(instructorId: number) {
  const courses = await prisma.course.findMany({
    where: {
      instructorId,
    },
    select: {
      id: true,
    },
  });

  return courses.map((course) => course.id);
}

async function getEnrolledCourseIds(studentId: number) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: studentId,
    },
    select: {
      courseId: true,
    },
  });

  return enrollments.map((enrollment) => enrollment.courseId);
}

announcementRouter.get(
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
        const announcements = await prisma.announcement.findMany({
          orderBy: {
            createdAt: "desc",
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
          data: {
            announcements,
          },
        });

        return;
      }

      if (role === "INSTRUCTOR") {
        const assignedCourseIds = await getAssignedCourseIds(userId);

        const announcements = await prisma.announcement.findMany({
          where: {
            OR: [
              {
                target: "ALL",
              },
              {
                target: "INSTRUCTORS",
              },
              {
                target: "COURSE",
                courseId: {
                  in: assignedCourseIds,
                },
              },
            ],
          },
          orderBy: {
            createdAt: "desc",
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
          data: {
            announcements,
          },
        });

        return;
      }

      const enrolledCourseIds = await getEnrolledCourseIds(userId);

      const announcements = await prisma.announcement.findMany({
        where: {
          OR: [
            {
              target: "ALL",
            },
            {
              target: "STUDENTS",
            },
            {
              target: "COURSE",
              courseId: {
                in: enrolledCourseIds,
              },
            },
          ],
        },
        orderBy: {
          createdAt: "desc",
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
        data: {
          announcements,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.post(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;

      const title = String(request.body.title || "").trim();
      const message = String(request.body.message || "").trim();
      const target = normalizeTarget(request.body.target);
      const rawCourseId = request.body.courseId;

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
          message: "Students cannot create announcements.",
        });

        return;
      }

      if (!title || !message) {
        response.status(400).json({
          success: false,
          message: "Announcement title and message are required.",
        });

        return;
      }

      if (!target) {
        response.status(400).json({
          success: false,
          message: "Valid target is required.",
        });

        return;
      }

      if (role === "INSTRUCTOR" && target !== "COURSE") {
        response.status(403).json({
          success: false,
          message: "Instructors can create only course announcements.",
        });

        return;
      }

      let courseId: number | null = null;

      if (target === "COURSE") {
        courseId = Number(rawCourseId);

        if (!Number.isInteger(courseId) || courseId <= 0) {
          response.status(400).json({
            success: false,
            message: "Valid course is required for course announcement.",
          });

          return;
        }

        const course = await prisma.course.findUnique({
          where: {
            id: courseId,
          },
          select: {
            id: true,
            instructorId: true,
          },
        });

        if (!course) {
          response.status(404).json({
            success: false,
            message: "Course not found.",
          });

          return;
        }

        if (role === "INSTRUCTOR" && course.instructorId !== userId) {
          response.status(403).json({
            success: false,
            message: "You can post only for your assigned courses.",
          });

          return;
        }
      }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          message,
          target,
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
        message: "Announcement created successfully.",
        data: {
          announcement,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.patch(
  "/:announcementId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const announcementId = getNumberId(request.params.announcementId);

      const title = String(request.body.title || "").trim();
      const message = String(request.body.message || "").trim();
      const target = normalizeTarget(request.body.target);
      const rawCourseId = request.body.courseId;

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!announcementId) {
        response.status(400).json({
          success: false,
          message: "Valid announcement is required.",
        });

        return;
      }

      if (role === "STUDENT") {
        response.status(403).json({
          success: false,
          message: "Students cannot update announcements.",
        });

        return;
      }

      if (!title || !message) {
        response.status(400).json({
          success: false,
          message: "Announcement title and message are required.",
        });

        return;
      }

      if (!target) {
        response.status(400).json({
          success: false,
          message: "Valid target is required.",
        });

        return;
      }

      const existingAnnouncement = await prisma.announcement.findUnique({
        where: {
          id: announcementId,
        },
      });

      if (!existingAnnouncement) {
        response.status(404).json({
          success: false,
          message: "Announcement not found.",
        });

        return;
      }

      if (role === "INSTRUCTOR") {
        if (existingAnnouncement.authorId !== userId) {
          response.status(403).json({
            success: false,
            message: "You can update only your own announcements.",
          });

          return;
        }

        if (target !== "COURSE") {
          response.status(403).json({
            success: false,
            message: "Instructors can update only course announcements.",
          });

          return;
        }
      }

      let courseId: number | null = null;

      if (target === "COURSE") {
        courseId = Number(rawCourseId);

        if (!Number.isInteger(courseId) || courseId <= 0) {
          response.status(400).json({
            success: false,
            message: "Valid course is required for course announcement.",
          });

          return;
        }

        const course = await prisma.course.findUnique({
          where: {
            id: courseId,
          },
          select: {
            id: true,
            instructorId: true,
          },
        });

        if (!course) {
          response.status(404).json({
            success: false,
            message: "Course not found.",
          });

          return;
        }

        if (role === "INSTRUCTOR" && course.instructorId !== userId) {
          response.status(403).json({
            success: false,
            message: "You can post only for your assigned courses.",
          });

          return;
        }
      }

      const announcement = await prisma.announcement.update({
        where: {
          id: announcementId,
        },
        data: {
          title,
          message,
          target,
          courseId,
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
        message: "Announcement updated successfully.",
        data: {
          announcement,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.delete(
  "/:announcementId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const announcementId = getNumberId(request.params.announcementId);

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!announcementId) {
        response.status(400).json({
          success: false,
          message: "Valid announcement is required.",
        });

        return;
      }

      if (role === "STUDENT") {
        response.status(403).json({
          success: false,
          message: "Students cannot delete announcements.",
        });

        return;
      }

      const announcement = await prisma.announcement.findUnique({
        where: {
          id: announcementId,
        },
      });

      if (!announcement) {
        response.status(404).json({
          success: false,
          message: "Announcement not found.",
        });

        return;
      }

      if (role === "INSTRUCTOR" && announcement.authorId !== userId) {
        response.status(403).json({
          success: false,
          message: "You can delete only your own announcements.",
        });

        return;
      }

      await prisma.announcement.delete({
        where: {
          id: announcementId,
        },
      });

      response.json({
        success: true,
        message: "Announcement deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default announcementRouter;