import { Router } from "express";
import { courses } from "../data/courses.js";
const courseRouter = Router();
courseRouter.get("/", (_request, response) => {
    response.json({
        success: true,
        count: courses.length,
        data: courses,
    });
});
courseRouter.get("/:courseId", (request, response) => {
    const courseId = Number(request.params.courseId);
    const course = courses.find((currentCourse) => currentCourse.id === courseId);
    if (!course) {
        response.status(404).json({
            success: false,
            message: "Course not found",
        });
        return;
    }
    response.json({
        success: true,
        data: course,
    });
});
export default courseRouter;
