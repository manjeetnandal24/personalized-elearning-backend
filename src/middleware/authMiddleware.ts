import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { attachActivityLogger } from "./activityLoggerMiddleware.js";

import { prisma } from "../lib/prisma.js";

export type AuthUser = {
  userId: number;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
};

type TokenPayload = {
  userId: number;
  email?: string;
  role?: "STUDENT" | "INSTRUCTOR" | "ADMIN";
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export async function authenticateUser(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({
      success: false,
      message: "Authorization token is missing.",
    });

    return;
  }

  const token = authHeader.split(" ")[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    response.status(500).json({
      success: false,
      message: "JWT_SECRET is missing.",
    });

    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

    if (!decoded.userId) {
      response.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });

      return;
    }

    const freshUser = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!freshUser) {
      response.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });

      return;
    }

    request.user = {
      userId: freshUser.id,
      email: freshUser.email,
      role: freshUser.role,
    };

    attachActivityLogger(request, response);

    next();
  } catch {
    response.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}