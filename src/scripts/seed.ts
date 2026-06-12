import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("Seeding database...");

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Progress", "Enrollment", "Lesson", "Course", "User"
    RESTART IDENTITY CASCADE;
  `);

  await prisma.course.create({
    data: {
      shortName: "JS",
      title: "JavaScript Fundamentals",
      description:
        "Learn variables, functions, arrays, objects and modern JavaScript fundamentals.",
      level: "Beginner",
      instructor: "LearnTrack Team",
      lessons: {
        create: [
          {
            title: "Introduction to JavaScript",
            duration: "8 minutes",
            description:
              "Understand what JavaScript is and how it is used in web development.",
            position: 1,
          },
          {
            title: "Variables and Data Types",
            duration: "12 minutes",
            description: "Learn about strings, numbers, booleans, let and const.",
            position: 2,
          },
          {
            title: "Functions",
            duration: "15 minutes",
            description:
              "Learn how to create reusable blocks of JavaScript logic.",
            position: 3,
          },
          {
            title: "Arrays and Objects",
            duration: "18 minutes",
            description:
              "Store and organize multiple pieces of related information.",
            position: 4,
          },
          {
            title: "Array Methods",
            duration: "16 minutes",
            description:
              "Use methods such as map, filter and find with arrays.",
            position: 5,
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      shortName: "RE",
      title: "React Basics",
      description:
        "Learn components, props, state and the fundamentals of React applications.",
      level: "Beginner",
      instructor: "LearnTrack Team",
      lessons: {
        create: [
          {
            title: "Introduction to React",
            duration: "10 minutes",
            description:
              "Understand React and component-based user interfaces.",
            position: 1,
          },
          {
            title: "Creating Components",
            duration: "15 minutes",
            description: "Create and reuse functional React components.",
            position: 2,
          },
          {
            title: "Understanding Props",
            duration: "14 minutes",
            description:
              "Pass information from a parent component to a child component.",
            position: 3,
          },
          {
            title: "React State",
            duration: "18 minutes",
            description:
              "Store and update changing information inside a component.",
            position: 4,
          },
          {
            title: "Rendering Lists",
            duration: "16 minutes",
            description:
              "Display collections of data using map and unique keys.",
            position: 5,
          },
          {
            title: "Handling Events",
            duration: "14 minutes",
            description:
              "Respond to button clicks and user interactions.",
            position: 6,
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      shortName: "DB",
      title: "Database Basics",
      description:
        "Understand databases, tables, records, relationships and basic SQL.",
      level: "Beginner",
      instructor: "LearnTrack Team",
      lessons: {
        create: [
          {
            title: "What is a Database?",
            duration: "9 minutes",
            description:
              "Understand why applications use databases to store information.",
            position: 1,
          },
          {
            title: "Tables, Rows and Columns",
            duration: "12 minutes",
            description:
              "Learn how relational databases organize their data.",
            position: 2,
          },
          {
            title: "Primary and Foreign Keys",
            duration: "15 minutes",
            description:
              "Understand identifiers and relationships between tables.",
            position: 3,
          },
          {
            title: "Introduction to SQL",
            duration: "17 minutes",
            description:
              "Learn the purpose of SQL and basic database operations.",
            position: 4,
          },
          {
            title: "CRUD Operations",
            duration: "20 minutes",
            description:
              "Understand Create, Read, Update and Delete operations.",
            position: 5,
          },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      shortName: "TS",
      title: "TypeScript Basics",
      description:
        "Learn types, interfaces and TypeScript fundamentals for safer code.",
      level: "Beginner",
      instructor: "LearnTrack Team",
      lessons: {
        create: [
          {
            title: "Why TypeScript?",
            duration: "8 minutes",
            description:
              "Understand how TypeScript improves JavaScript development.",
            position: 1,
          },
          {
            title: "Basic Types",
            duration: "14 minutes",
            description:
              "Use string, number, boolean, array and object types.",
            position: 2,
          },
          {
            title: "Type Aliases",
            duration: "12 minutes",
            description:
              "Create reusable custom types for application data.",
            position: 3,
          },
          {
            title: "Interfaces",
            duration: "16 minutes",
            description:
              "Describe the required structure of an object.",
            position: 4,
          },
          {
            title: "Typing Functions",
            duration: "15 minutes",
            description:
              "Add types to function parameters and returned values.",
            position: 5,
          },
        ],
      },
    },
  });

  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });