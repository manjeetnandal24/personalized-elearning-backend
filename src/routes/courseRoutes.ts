import { Router } from "express";

import { prisma } from "../lib/prisma.js";

const courseRouter = Router();

courseRouter.get("/", async (_request, response, next) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: {
        id: "asc",
      },
      include: {
        lessons: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    response.json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
});

courseRouter.get("/:courseId", async (request, response, next) => {
  try {
    const courseId = Number(request.params.courseId);

    if (Number.isNaN(courseId)) {
      response.status(400).json({
        success: false,
        message: "Invalid course ID",
      });

      return;
    }

    const course = await prisma.course.findUnique({
      where: {
        id: courseId,
      },
      include: {
        lessons: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (!course) {
      response.status(404).json({
        success: false,
        message: "Course not found",
      });

      return;
    }

    response.json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
});

export default courseRouter;