import { prisma } from "../lib/prisma.js";

type ActivityMetadata = Record<string, string | number | boolean | null>;

type LogActivityInput = {
  action: string;
  message: string;
  entityType?: string;
  entityId?: number | null;
  actorId?: number | null;
  metadata?: ActivityMetadata;
};

export async function logActivity({
  action,
  message,
  entityType = "SYSTEM",
  entityId = null,
  actorId = null,
  metadata,
}: LogActivityInput) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        message,
        entityType,
        entityId,
        actorId,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Activity log failed:", error);
  }
}