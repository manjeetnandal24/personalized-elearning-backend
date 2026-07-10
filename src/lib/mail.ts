import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;

function getTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export async function sendVerificationEmail(email: string, link: string) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("Email verification link:", link);
    return;
  }

  await transporter.sendMail({
    from: mailFrom,
    to: email,
    subject: "Verify your LearnTrack account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Verify your LearnTrack account</h2>
        <p>Thanks for creating your LearnTrack account.</p>
        <p>Click the button below to verify your email address:</p>
        <p>
          <a href="${link}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </p>
        <p>This link will expire soon.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, link: string) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("Password reset link:", link);
    return;
  }

  await transporter.sendMail({
    from: mailFrom,
    to: email,
    subject: "Reset your LearnTrack password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your LearnTrack password</h2>
        <p>We received a request to reset your LearnTrack password.</p>
        <p>Click the button below to set a new password:</p>
        <p>
          <a href="${link}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </p>
        <p>This password reset link will expire in 1 hour.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}