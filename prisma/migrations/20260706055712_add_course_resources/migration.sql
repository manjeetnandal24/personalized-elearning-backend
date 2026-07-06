-- CreateEnum
CREATE TYPE "CourseResourceType" AS ENUM ('LINK', 'PDF', 'VIDEO', 'NOTE', 'OTHER');

-- CreateTable
CREATE TABLE "CourseResource" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "resourceUrl" TEXT NOT NULL,
    "type" "CourseResourceType" NOT NULL DEFAULT 'LINK',
    "courseId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseResource_courseId_idx" ON "CourseResource"("courseId");

-- CreateIndex
CREATE INDEX "CourseResource_createdById_idx" ON "CourseResource"("createdById");

-- CreateIndex
CREATE INDEX "CourseResource_type_idx" ON "CourseResource"("type");

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
