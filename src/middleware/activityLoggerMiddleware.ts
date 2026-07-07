import type { Request, Response } from "express";

import { logActivity } from "../utils/activityLogger.js";

type RequestWithUser = Request & {
  user?: {
    userId: number;
    email: string;
    role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  };
};

function normalizePath(originalUrl: string) {
  return originalUrl.split("?")[0].replace(/^\/api\//, "");
}

function getActivityDescription(method: string, originalUrl: string) {
  const path = normalizePath(originalUrl);

  if (path.startsWith("admin/instructors/users")) {
    return {
      action: "USER_ROLE_UPDATED",
      entityType: "USER",
      message: "User role was updated by admin.",
    };
  }

  if (path.startsWith("admin/instructors/courses")) {
    return {
      action: "COURSE_INSTRUCTOR_UPDATED",
      entityType: "COURSE",
      message: "Course instructor assignment was updated.",
    };
  }

  if (path.startsWith("announcements")) {
    if (method === "POST") {
      return {
        action: "ANNOUNCEMENT_CREATED",
        entityType: "ANNOUNCEMENT",
        message: "Announcement was created.",
      };
    }

    if (method === "PATCH") {
      return {
        action: "ANNOUNCEMENT_UPDATED",
        entityType: "ANNOUNCEMENT",
        message: "Announcement was updated.",
      };
    }

    return {
      action: "ANNOUNCEMENT_DELETED",
      entityType: "ANNOUNCEMENT",
      message: "Announcement was deleted.",
    };
  }

  if (path.startsWith("course-resources")) {
    if (method === "POST") {
      return {
        action: "RESOURCE_CREATED",
        entityType: "COURSE_RESOURCE",
        message: "Course resource was created.",
      };
    }

    if (method === "PATCH") {
      return {
        action: "RESOURCE_UPDATED",
        entityType: "COURSE_RESOURCE",
        message: "Course resource was updated.",
      };
    }

    return {
      action: "RESOURCE_DELETED",
      entityType: "COURSE_RESOURCE",
      message: "Course resource was deleted.",
    };
  }

  if (path.startsWith("discussions") && path.includes("/replies")) {
    if (method === "POST") {
      return {
        action: "DISCUSSION_REPLY_CREATED",
        entityType: "DISCUSSION_REPLY",
        message: "Discussion reply was added.",
      };
    }

    return {
      action: "DISCUSSION_REPLY_DELETED",
      entityType: "DISCUSSION_REPLY",
      message: "Discussion reply was deleted.",
    };
  }

  if (path.startsWith("discussions") && path.includes("/status")) {
    return {
      action: "DISCUSSION_STATUS_UPDATED",
      entityType: "DISCUSSION",
      message: "Discussion status was updated.",
    };
  }

  if (path.startsWith("discussions")) {
    if (method === "POST") {
      return {
        action: "DISCUSSION_CREATED",
        entityType: "DISCUSSION",
        message: "Discussion was created.",
      };
    }

    return {
      action: "DISCUSSION_DELETED",
      entityType: "DISCUSSION",
      message: "Discussion was deleted.",
    };
  }

  if (path.startsWith("support-tickets") && path.includes("/replies")) {
    return {
      action: "SUPPORT_REPLY_CREATED",
      entityType: "SUPPORT_REPLY",
      message: "Support ticket reply was added.",
    };
  }

  if (path.startsWith("support-tickets") && path.includes("/status")) {
    return {
      action: "SUPPORT_STATUS_UPDATED",
      entityType: "SUPPORT_TICKET",
      message: "Support ticket status was updated.",
    };
  }

  if (path.startsWith("support-tickets")) {
    if (method === "POST") {
      return {
        action: "SUPPORT_TICKET_CREATED",
        entityType: "SUPPORT_TICKET",
        message: "Support ticket was created.",
      };
    }

    return {
      action: "SUPPORT_TICKET_DELETED",
      entityType: "SUPPORT_TICKET",
      message: "Support ticket was deleted.",
    };
  }

  const cleanAction = path
    .split("/")[0]
    .replace(/-/g, "_")
    .toUpperCase();

  return {
    action: `${cleanAction}_${method}`,
    entityType: cleanAction || "SYSTEM",
    message: `${method} request completed on ${path}.`,
  };
}

export function attachActivityLogger(
  request: RequestWithUser,
  response: Response,
) {
  if (response.locals.activityLoggerAttached) {
    return;
  }

  response.locals.activityLoggerAttached = true;

  const startedAt = Date.now();

  response.on("finish", () => {
    const method = request.method.toUpperCase();
    const isMutation = ["POST", "PATCH", "DELETE"].includes(method);
    const isSuccessful = response.statusCode >= 200 && response.statusCode < 400;

    if (!isMutation || !isSuccessful || !request.user?.userId) {
      return;
    }

    const activity = getActivityDescription(method, request.originalUrl);

    void logActivity({
      action: activity.action,
      message: activity.message,
      entityType: activity.entityType,
      actorId: request.user.userId,
      metadata: {
        method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      },
    });
  });
}