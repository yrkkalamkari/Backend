const { PrismaClient } = require("@prisma/client");

// Reuse a single Prisma client across the app (avoids exhausting DB connections)
const prisma = new PrismaClient();

module.exports = prisma;
