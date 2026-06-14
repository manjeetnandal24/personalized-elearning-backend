import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = {
  userId: number;
  email: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export function authenticateUser(
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
    const decoded = jwt.verify(token, jwtSecret) as AuthUser;

    request.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch {
    response.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}