import { Router } from "express";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const adminActivityLogRouter = Router();

adminActivityLogRouter.use(authenticateUser);
adminActivityLogRouter.use(requireAdmin);

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
}

adminActivityLogRouter.get(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const search = getQueryValue(request.query.search);
      const action = getQueryValue(request.query.action);
      const entityType = getQueryValue(request.query.entityType);

      const rawLimit = Number(getQueryValue(request.query.limit));
      const limit =
        Number.isInteger(rawLimit) && rawLimit > 0
          ? Math.min(rawLimit, 100)
          : 50;

      const where = {} as {
        action?: {
          contains: string;
          mode: "insensitive";
        };
        entityType?: {
          contains: string;
          mode: "insensitive";
        };
        OR?: Array<{
          message?: {
            contains: string;
            mode: "insensitive";
          };
          action?: {
            contains: string;
            mode: "insensitive";
          };
          entityType?: {
            contains: string;
            mode: "insensitive";
          };
        }>;
      };

      if (action) {
        where.action = {
          contains: action,
          mode: "insensitive",
        };
      }

      if (entityType) {
        where.entityType = {
          contains: entityType,
          mode: "insensitive",
        };
      }

      if (search) {
        where.OR = [
          {
            message: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            action: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            entityType: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [logs, totalLogs, filteredCount, todayLogs, recentActions] =
        await Promise.all([
          prisma.activityLog.findMany({
            where,
            take: limit,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              actor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          }),
          prisma.activityLog.count(),
          prisma.activityLog.count({
            where,
          }),
          prisma.activityLog.count({
            where: {
              createdAt: {
                gte: today,
              },
            },
          }),
          prisma.activityLog.findMany({
            take: 500,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              action: true,
              entityType: true,
            },
          }),
        ]);

      const actionCounts = recentActions.reduce<Record<string, number>>(
        (counts, log) => {
          counts[log.action] = (counts[log.action] || 0) + 1;
          return counts;
        },
        {},
      );

      const topActions = Object.entries(actionCounts)
        .map(([name, count]) => ({
          name,
          count,
        }))
        .sort((first, second) => second.count - first.count)
        .slice(0, 6);

      const entityTypes = Array.from(
        new Set(recentActions.map((log) => log.entityType)),
      ).filter(Boolean);

      response.json({
        success: true,
        data: {
          stats: {
            totalLogs,
            filteredCount,
            todayLogs,
            displayedLogs: logs.length,
          },
          topActions,
          entityTypes,
          logs,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default adminActivityLogRouter;