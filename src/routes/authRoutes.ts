import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";

import { prisma } from "../lib/prisma.js";

const authRouter = Router();

function createToken(userId: number, email: string) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing in .env file");
  }

  return jwt.sign(
    {
      userId,
      email,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    },
  );
}

authRouter.post("/register", async (request, response, next) => {
  try {
    const { name, email, password } = request.body;

    if (!name || !email || !password) {
      response.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });

      return;
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (cleanName.length < 2) {
      response.status(400).json({
        success: false,
        message: "Name must contain at least 2 characters.",
      });

      return;
    }

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      response.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });

      return;
    }

    if (cleanPassword.length < 8) {
      response.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });

      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
    });

    if (existingUser) {
      response.status(409).json({
        success: false,
        message: "User with this email already exists.",
      });

      return;
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const token = createToken(user.id, user.email);

    response.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      response.status(400).json({
        success: false,
        message: "Email and password are required.",
      });

      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    const user = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
    });

    if (!user) {
      response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });

      return;
    }

    const passwordIsCorrect = await bcrypt.compare(
      cleanPassword,
      user.passwordHash,
    );

    if (!passwordIsCorrect) {
      response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });

      return;
    }

    const token = createToken(user.id, user.email);

    response.json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (request, response) => {
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
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: number;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      response.status(404).json({
        success: false,
        message: "User not found.",
      });

      return;
    }

    response.json({
      success: true,
      data: {
        user,
      },
    });
  } catch {
    response.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
});

export default authRouter;
