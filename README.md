# LearnTrack Backend

This is the backend repository of **LearnTrack - Personalized E-Learning Platform**.

LearnTrack is a full-stack Learning Management System with role-based access for Admin, Instructor, and Student users.

---

## Repositories

Frontend Repository:  
https://github.com/manjeetnandal24/personalized-elearning-platform.git

Backend Repository:  
https://github.com/manjeetnandal24/personalized-elearning-backend.git

---

## Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT Authentication
- Bcrypt.js
- Nodemailer
- Gemini API

---

## Main Backend Features

### Authentication
- User registration
- User login
- JWT-based authentication
- Email verification
- Forgot password
- Reset password through email link
- Role-based access control

### Admin APIs
- Manage students
- Manage instructors
- Promote students to instructors
- Assign instructors to courses
- Manage courses
- Manage curriculum
- Manage quizzes
- Manage certificates
- View analytics
- Manage announcements
- Manage course resources
- View contact/support queries

### Instructor APIs
- View assigned courses
- Manage curriculum for assigned courses
- Manage quizzes for assigned courses
- View enrolled students
- View instructor analytics
- Add announcements
- Add course resources

### Student APIs
- Browse courses
- Enroll in courses
- Track lesson progress
- Attempt quizzes
- View quiz results
- View certificates
- View announcements
- Access course resources
- Update profile
- Send support/contact queries

### Extra
- AI assistant API
- Email sending using Nodemailer
- Secure password reset token system

---

## Environment Variables

Create a `.env` file in the backend root folder:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/learntrack_db"

JWT_SECRET="your-jwt-secret"

FRONTEND_URL="http://localhost:5173"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-learntrack-email@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM="LearnTrack <your-learntrack-email@gmail.com>"

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
```

Important:

```text
Do not upload .env to GitHub.
SMTP_PASS is not your normal Gmail password.
SMTP_PASS is the Google App Password.
```

---

## How to Run Backend

Install dependencies:

```bash
npm install
```

Run Prisma migration:

```bash
npx prisma migrate dev
```

Generate Prisma client:

```bash
npx prisma generate
```

Start development server:

```bash
npm run dev
```

Build backend:

```bash
npm run build
```

Backend runs on:

```text
http://localhost:5000
```

---

## Email Setup

LearnTrack uses Gmail SMTP with Nodemailer for email verification and password reset emails.

Steps:

1. Create a separate Gmail account for LearnTrack.
2. Turn on 2-Step Verification.
3. Generate a Google App Password.
4. Use that App Password in `.env` as `SMTP_PASS`.

Example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=learntrack.project@gmail.com
SMTP_PASS=yourgoogleapppassword
MAIL_FROM="LearnTrack <learntrack.project@gmail.com>"
```

---

## Authentication Flow

### Email Verification

```text
User registers
→ Verification email is sent
→ User clicks verification link
→ Email is verified
→ User can login
```

### Password Reset

```text
User clicks Forgot Password
→ Password reset email is sent
→ User clicks reset link
→ User sets new password
→ Reset token is cleared
→ User can login with new password
```

---

## Security

- Passwords are hashed using bcrypt.
- JWT is used for authentication.
- Protected routes require valid token.
- Email verification is required before login.
- Password reset uses secure random tokens.
- Password reset tokens expire after a fixed time.
- Password reset tokens are cleared after successful reset.
- `.env`, `node_modules`, `dist`, and generated files should not be committed.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@test.com | Available on request |
| Instructor | instructor@test.com | Available on request |
| Student | teststudent3@example.com | Available on request |

---

## Developed By

Manjeet Nandal  
B.Tech CSE  
Project: LearnTrack - Personalized E-Learning Platform