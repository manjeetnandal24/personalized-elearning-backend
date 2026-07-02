import type { Response, NextFunction } from "express";

import type { AuthenticatedRequest } from "./authMiddleware.js";

export function requireInstructor(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  if (request.user?.role !== "INSTRUCTOR") {
    response.status(403).json({
      success: false,
      message: "Instructor access required.",
    });

    return;
  }

  next();
}