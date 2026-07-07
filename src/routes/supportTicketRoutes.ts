import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const supportTicketRouter = Router();

supportTicketRouter.use(authenticateUser);

type SupportStatusValue = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SupportPriorityValue = "LOW" | "MEDIUM" | "HIGH";

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

function normalizeStatus(value: unknown): SupportStatusValue | null {
  const status = String(value || "").trim().toUpperCase();

  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
    return null;
  }

  return status as SupportStatusValue;
}

function normalizePriority(value: unknown): SupportPriorityValue | null {
  const priority = String(value || "").trim().toUpperCase();

  if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) {
    return null;
  }

  return priority as SupportPriorityValue;
}

const ticketInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  replies: {
    orderBy: {
      createdAt: "asc" as const,
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
};

supportTicketRouter.get(
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

      const tickets = await prisma.supportTicket.findMany({
        where:
          role === "ADMIN"
            ? undefined
            : {
                userId,
              },
        orderBy: {
          updatedAt: "desc",
        },
        include: ticketInclude,
      });

      response.json({
        success: true,
        data: {
          tickets,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

supportTicketRouter.post(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;

      const title = String(request.body.title || "").trim();
      const message = String(request.body.message || "").trim();
      const category = String(request.body.category || "General").trim();
      const priority = normalizePriority(request.body.priority) || "MEDIUM";

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!title || !message) {
        response.status(400).json({
          success: false,
          message: "Support title and message are required.",
        });

        return;
      }

      const ticket = await prisma.supportTicket.create({
        data: {
          title,
          message,
          category: category || "General",
          priority,
          userId,
        },
        include: ticketInclude,
      });

      response.status(201).json({
        success: true,
        message: "Support ticket created successfully.",
        data: {
          ticket,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

supportTicketRouter.post(
  "/:ticketId/replies",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const role = request.user?.role;
      const ticketId = getNumberId(request.params.ticketId);
      const message = String(request.body.message || "").trim();

      if (!userId || !role) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!ticketId) {
        response.status(400).json({
          success: false,
          message: "Valid support ticket is required.",
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

      const ticket = await prisma.supportTicket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
          userId: true,
          status: true,
        },
      });

      if (!ticket) {
        response.status(404).json({
          success: false,
          message: "Support ticket not found.",
        });

        return;
      }

      if (role !== "ADMIN" && ticket.userId !== userId) {
        response.status(403).json({
          success: false,
          message: "You can reply only to your own support ticket.",
        });

        return;
      }

      if (ticket.status === "CLOSED") {
        response.status(400).json({
          success: false,
          message: "Closed tickets cannot receive new replies.",
        });

        return;
      }

      const reply = await prisma.supportTicketReply.create({
        data: {
          message,
          ticketId,
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

      await prisma.supportTicket.update({
        where: {
          id: ticketId,
        },
        data: {
          updatedAt: new Date(),
          status: role === "ADMIN" ? "IN_PROGRESS" : ticket.status,
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

supportTicketRouter.patch(
  "/:ticketId/status",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const role = request.user?.role;
      const ticketId = getNumberId(request.params.ticketId);
      const status = normalizeStatus(request.body.status);

      if (role !== "ADMIN") {
        response.status(403).json({
          success: false,
          message: "Only admin can update support ticket status.",
        });

        return;
      }

      if (!ticketId) {
        response.status(400).json({
          success: false,
          message: "Valid support ticket is required.",
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

      const existingTicket = await prisma.supportTicket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
        },
      });

      if (!existingTicket) {
        response.status(404).json({
          success: false,
          message: "Support ticket not found.",
        });

        return;
      }

      const ticket = await prisma.supportTicket.update({
        where: {
          id: ticketId,
        },
        data: {
          status,
        },
        include: ticketInclude,
      });

      response.json({
        success: true,
        message: "Support ticket status updated successfully.",
        data: {
          ticket,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

supportTicketRouter.delete(
  "/:ticketId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const role = request.user?.role;
      const ticketId = getNumberId(request.params.ticketId);

      if (role !== "ADMIN") {
        response.status(403).json({
          success: false,
          message: "Only admin can delete support tickets.",
        });

        return;
      }

      if (!ticketId) {
        response.status(400).json({
          success: false,
          message: "Valid support ticket is required.",
        });

        return;
      }

      const ticket = await prisma.supportTicket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
        },
      });

      if (!ticket) {
        response.status(404).json({
          success: false,
          message: "Support ticket not found.",
        });

        return;
      }

      await prisma.supportTicket.delete({
        where: {
          id: ticketId,
        },
      });

      response.json({
        success: true,
        message: "Support ticket deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default supportTicketRouter;