// Usage: node prisma/makeAdmin.js someone@gmail.com
// Run this AFTER that person has logged in at least once via Google
// (so their user row already exists), to grant them admin access.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node prisma/makeAdmin.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`${user.email} is now an ADMIN.`);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
