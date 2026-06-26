import { Router } from "express";
import type { Prisma } from "../generated/prisma/client.js";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";

const quizRouter = Router();

function isValidOption(option: string) {
  return ["A", "B", "C", "D"].includes(option);
}

quizRouter.get("/courses/:courseId", async (request, response, next) => {
  try {
    const courseId = Number(request.params.courseId);

    if (Number.isNaN(courseId)) {
      response.status(400).json({
        success: false,
        message: "Invalid course ID.",
      });

      return;
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        courseId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
        questions: {
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
            question: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            points: true,
            position: true,
          },
        },
      },
    });

    response.json({
      success: true,
      data: {
        quizzes,
      },
    });
  } catch (error) {
    next(error);
  }
});

quizRouter.get(
  "/admin/courses/:courseId",
  authenticateUser,
  requireAdmin,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      const quizzes = await prisma.quiz.findMany({
        where: {
          courseId,
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
              position: true,
            },
          },
          questions: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      response.json({
        success: true,
        data: {
          quizzes,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

quizRouter.post(
  "/admin/courses/:courseId",
  authenticateUser,
  requireAdmin,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const courseId = Number(request.params.courseId);
      const { title, description, passingScore, topicId } = request.body;

      const titleText = String(title || "").trim();
      const descriptionText = String(description || "").trim();

      const passingScoreNumber =
        passingScore === undefined || passingScore === ""
          ? 60
          : Number(passingScore);

      const topicIdNumber =
       topicId === undefined || topicId === "" || topicId === null
       ? null
        : Number(topicId);

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      if (!titleText || !descriptionText) {
        response.status(400).json({
          success: false,
          message: "Quiz title and description are required.",
        });

        return;
      }

      if (
        Number.isNaN(passingScoreNumber) ||
        passingScoreNumber < 0 ||
        passingScoreNumber > 100
      ) {
        response.status(400).json({
          success: false,
          message: "Passing score must be between 0 and 100.",
        });

        return;
      }

      if (topicIdNumber !== null && Number.isNaN(topicIdNumber)) {
        response.status(400).json({
          success: false,
          message: "Invalid topic ID.",
        });

        return;
      }

      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
        },
      });

      if (!course) {
        response.status(404).json({
          success: false,
          message: "Course not found.",
        });

        return;
      }

      if (topicIdNumber !== null) {
        const topic = await prisma.topic.findFirst({
          where: {
            id: topicIdNumber,
            courseId,
          },
        });

        if (!topic) {
          response.status(404).json({
            success: false,
            message: "Topic not found for this course.",
          });

          return;
        }
      }

      const quiz = await prisma.quiz.create({
        data: {
          title: titleText,
          description: descriptionText,
          passingScore: passingScoreNumber,
          courseId,
          topicId: topicIdNumber,
        },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
              position: true,
            },
          },
          questions: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      response.status(201).json({
        success: true,
        message: "Quiz created successfully.",
        data: {
          quiz,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

quizRouter.post(
  "/admin/:quizId/questions",
  authenticateUser,
  requireAdmin,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const quizId = Number(request.params.quizId);

      const {
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        explanation,
        points,
      } = request.body;

      const questionText = String(question || "").trim();
      const optionAText = String(optionA || "").trim();
      const optionBText = String(optionB || "").trim();
      const optionCText = String(optionC || "").trim();
      const optionDText = String(optionD || "").trim();
      const correctOptionText = String(correctOption || "").trim().toUpperCase();
      const explanationText = String(explanation || "").trim();

      const pointsNumber =
        points === undefined || points === "" ? 1 : Number(points);

      if (Number.isNaN(quizId)) {
        response.status(400).json({
          success: false,
          message: "Invalid quiz ID.",
        });

        return;
      }

      if (
        !questionText ||
        !optionAText ||
        !optionBText ||
        !optionCText ||
        !optionDText ||
        !correctOptionText
      ) {
        response.status(400).json({
          success: false,
          message: "All question fields are required.",
        });

        return;
      }

      if (!isValidOption(correctOptionText)) {
        response.status(400).json({
          success: false,
          message: "Correct option must be A, B, C or D.",
        });

        return;
      }

      if (Number.isNaN(pointsNumber) || pointsNumber <= 0) {
        response.status(400).json({
          success: false,
          message: "Points must be a positive number.",
        });

        return;
      }

      const quiz = await prisma.quiz.findUnique({
        where: {
          id: quizId,
        },
        include: {
          questions: true,
        },
      });

      if (!quiz) {
        response.status(404).json({
          success: false,
          message: "Quiz not found.",
        });

        return;
      }

      const nextPosition = quiz.questions.length + 1;

      const quizQuestion = await prisma.quizQuestion.create({
        data: {
          quizId,
          question: questionText,
          optionA: optionAText,
          optionB: optionBText,
          optionC: optionCText,
          optionD: optionDText,
          correctOption: correctOptionText,
          explanation: explanationText,
          points: pointsNumber,
          position: nextPosition,
        },
      });

      response.status(201).json({
        success: true,
        message: "Question added successfully.",
        data: {
          question: quizQuestion,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

quizRouter.post(
  "/:quizId/submit",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const quizId = Number(request.params.quizId);
      const userId = request.user?.userId;
      const { answers } = request.body;

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (Number.isNaN(quizId)) {
        response.status(400).json({
          success: false,
          message: "Invalid quiz ID.",
        });

        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user) {
        response.status(404).json({
          success: false,
          message: "User not found.",
        });

        return;
      }

      if (user.role === "ADMIN") {
        response.status(403).json({
          success: false,
          message: "Admins cannot submit student quizzes.",
        });

        return;
      }

      if (!Array.isArray(answers)) {
        response.status(400).json({
          success: false,
          message: "Answers must be an array.",
        });

        return;
      }

      const quiz = await prisma.quiz.findUnique({
        where: {
          id: quizId,
        },
        include: {
          questions: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      if (!quiz) {
        response.status(404).json({
          success: false,
          message: "Quiz not found.",
        });

        return;
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: quiz.courseId,
          },
        },
      });

      if (!enrollment) {
        response.status(403).json({
          success: false,
          message: "Please enroll in this course before attempting quizzes.",
        });

        return;
      }

      if (quiz.questions.length === 0) {
        response.status(400).json({
          success: false,
          message: "This quiz has no questions yet.",
        });

        return;
      }

      const answerMap = new Map<number, string>();

      for (const answer of answers) {
        const questionId = Number(answer.questionId);
        const selectedOption = String(answer.selectedOption || "")
          .trim()
          .toUpperCase();

        if (!Number.isNaN(questionId) && isValidOption(selectedOption)) {
          answerMap.set(questionId, selectedOption);
        }
      }

      let correctAnswers = 0;

      const checkedAnswers = quiz.questions.map((question) => {
        const selectedOption = answerMap.get(question.id) || "";
        const isCorrect = selectedOption === question.correctOption;

        if (isCorrect) {
          correctAnswers += 1;
        }

        return {
          questionId: question.id,
          question: question.question,
          selectedOption,
          correctOption: question.correctOption,
          isCorrect,
          explanation: question.explanation,
        };
      });

      const totalQuestions = quiz.questions.length;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const passed = score >= quiz.passingScore;

      const attempt = await prisma.quizAttempt.create({
        data: {
          userId,
          quizId,
          score,
          totalQuestions,
          correctAnswers,
          passed,
          selectedAnswers: checkedAnswers as Prisma.InputJsonValue,
        },
      });

      response.status(201).json({
        success: true,
        message: "Quiz submitted successfully.",
        data: {
          attempt: {
            id: attempt.id,
            quizId,
            score,
            totalQuestions,
            correctAnswers,
            passed,
            answers: checkedAnswers,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

quizRouter.get(
  "/attempts/courses/:courseId",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.user?.userId;
      const courseId = Number(request.params.courseId);

      if (!userId) {
        response.status(401).json({
          success: false,
          message: "User is not authenticated.",
        });

        return;
      }

      if (Number.isNaN(courseId)) {
        response.status(400).json({
          success: false,
          message: "Invalid course ID.",
        });

        return;
      }

      const attempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          quiz: {
            courseId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              passingScore: true,
              courseId: true,
              topicId: true,
            },
          },
        },
      });

      response.json({
        success: true,
        data: {
          attempts,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default quizRouter;
