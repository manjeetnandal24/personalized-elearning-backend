import crypto from "crypto";

import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";

import { prisma } from "../lib/prisma.js";

const authRouter = Router();

function createToken(
  userId: number,
  email: string,
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN",
) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing in .env file");
  }

  return jwt.sign(
    {
      userId,
      email,
      role,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    },
  );
}

function createEmailVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createEmailVerificationExpiry() {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate;
}

function createVerificationLink(token: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${frontendUrl}/verify-email/${token}`;
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createPasswordResetExpiry() {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 1);
  return expiryDate;
}

function createPasswordResetLink(token: string) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${frontendUrl}/reset-password/${token}`;
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

    const emailVerificationToken = createEmailVerificationToken();
    const emailVerificationTokenExpiresAt = createEmailVerificationExpiry();

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationTokenExpiresAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    response.status(201).json({
      success: true,
      message:
        "Account created successfully. Please verify your email before login.",
      data: {
        user,
        verificationLink: createVerificationLink(emailVerificationToken),
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
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        emailVerified: true,
        createdAt: true,
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

    if (!user.emailVerified) {
      response.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        data: {
          needsEmailVerification: true,
        },
      });

      return;
    }

    const token = createToken(user.id, user.email, user.role);

    response.json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
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
      role?: "STUDENT" | "INSTRUCTOR" | "ADMIN";
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
        emailVerified: true,
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

authRouter.get("/verify-email/:token", async (request, response, next) => {
  try {
    const token = String(request.params.token || "").trim();

    if (!token) {
      response.status(400).json({
        success: false,
        message: "Verification token is required.",
      });

      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
      },
    });

    if (!user) {
      response.status(400).json({
        success: false,
        message: "Invalid or expired verification link.",
      });

      return;
    }

    if (
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      response.status(400).json({
        success: false,
        message: "Verification link expired. Please request a new one.",
      });

      return;
    }

    const verifiedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
      },
    });

    response.json({
      success: true,
      message: "Email verified successfully. You can now login.",
      data: {
        user: verifiedUser,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/resend-verification", async (request, response, next) => {
  try {
    const email = String(request.body.email || "").trim().toLowerCase();

    if (!email) {
      response.status(400).json({
        success: false,
        message: "Email is required.",
      });

      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      response.status(404).json({
        success: false,
        message: "Account not found.",
      });

      return;
    }

    if (user.emailVerified) {
      response.status(400).json({
        success: false,
        message: "Email is already verified. Please login.",
      });

      return;
    }

    const emailVerificationToken = createEmailVerificationToken();
    const emailVerificationTokenExpiresAt = createEmailVerificationExpiry();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerificationToken,
        emailVerificationTokenExpiresAt,
      },
    });

    response.json({
      success: true,
      message: "Verification link generated successfully.",
      data: {
        verificationLink: createVerificationLink(emailVerificationToken),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", async (request, response, next) => {
  try {
    const email = String(request.body.email || "").trim().toLowerCase();

    if (!email) {
      response.status(400).json({
        success: false,
        message: "Email is required.",
      });

      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      response.json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been generated.",
        data: {
          resetLink: null,
        },
      });

      return;
    }

    const passwordResetToken = createPasswordResetToken();
    const passwordResetTokenExpiresAt = createPasswordResetExpiry();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordResetToken,
        passwordResetTokenExpiresAt,
      },
    });

    response.json({
      success: true,
      message: "Password reset link generated successfully.",
      data: {
        resetLink: createPasswordResetLink(passwordResetToken),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password/:token", async (request, response, next) => {
  try {
    const token = String(request.params.token || "").trim();
    const password = String(request.body.password || "");

    if (!token) {
      response.status(400).json({
        success: false,
        message: "Password reset token is required.",
      });

      return;
    }

    if (password.length < 8) {
      response.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });

      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user) {
      response.status(400).json({
        success: false,
        message: "Invalid or expired password reset link.",
      });

      return;
    }

    if (
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      response.status(400).json({
        success: false,
        message: "Password reset link expired. Please request a new one.",
      });

      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    response.json({
      success: true,
      message: "Password reset successfully. You can now login.",
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;