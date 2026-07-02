import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

import {
  authenticateUser,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

const aiRouter = Router();

aiRouter.post(
  "/chat",
  authenticateUser,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        response.status(500).json({
          success: false,
          message: "Gemini API key is missing on backend.",
        });

        return;
      }

      const userMessage = String(request.body.message || "").trim();
      const pageContext = String(request.body.context || "").trim();

      if (!userMessage) {
        response.status(400).json({
          success: false,
          message: "Message is required.",
        });

        return;
      }

      if (userMessage.length > 1000) {
        response.status(400).json({
          success: false,
          message: "Message is too long. Please keep it under 1000 characters.",
        });

        return;
      }

      const userName = request.user?.email || "student";

      process.env.GEMINI_API_KEY = apiKey;

      const ai = new GoogleGenAI({});

      const interaction = await ai.interactions.create({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        input: `You are LearnTrack AI Assistant.

Rules:
- Help students understand course topics in simple language.
- Give short, clear, beginner-friendly answers.
- Help with coding, projects, courses, quizzes, and study doubts.
- Do not help with cheating, harmful activities, unsafe instructions, or illegal tasks.
- If the question is not about learning, politely redirect to study support.

User: ${userName}

Page context:
${pageContext || "No page context provided."}

Question:
${userMessage}`,
      });

      const reply =
        interaction.output_text ||
        "Sorry, I could not generate a response right now.";

      response.json({
        success: true,
        data: {
          reply,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("quota") ||
          error.message.includes("429") ||
          error.message.includes("billing") ||
          error.message.includes("API key"))
      ) {
        response.status(429).json({
          success: false,
          message:
            "AI assistant is temporarily unavailable because the free API limit or key setup has an issue.",
        });

        return;
      }

      next(error);
    }
  },
);

export default aiRouter;