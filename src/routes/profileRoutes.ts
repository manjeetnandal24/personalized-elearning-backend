import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { prisma } from "../lib/prisma.js";

const profileRouter = Router();

profileRouter.use(authenticateUser);

profileRouter.patch(
  "/name",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const nameText = String(request.body.name || "").trim();

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (!nameText) {
        response.status(400).json({
          success: false,
          message: "Name is required.",
        });

        return;
      }

      if (nameText.length < 2) {
        response.status(400).json({
          success: false,
          message: "Name must be at least 2 characters.",
        });

        return;
      }

      if (nameText.length > 60) {
        response.status(400).json({
          success: false,
          message: "Name cannot be more than 60 characters.",
        });

        return;
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: nameText,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      response.json({
        success: true,
        message: "Profile name updated successfully.",
        data: {
          user: updatedUser,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default profileRouter;