import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./authMiddleware.js";
import { prisma } from "../lib/prisma.js";

export async function requireAdmin(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  try {
    const userId = request.user?.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User is not authenticated.",
      });

      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role !== "ADMIN") {
      response.status(403).json({
        success: false,
        message: "Only admin users can access this route.",
      });

      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}