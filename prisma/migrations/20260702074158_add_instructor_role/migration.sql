-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'INSTRUCTOR';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "instructorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
