const { PrismaClient } = require("@prisma/client");
const slugify = require("slugify");
const prisma = new PrismaClient();

async function main() {
  const sarees = await prisma.category.upsert({
    where: { slug: "sarees" },
    update: {},
    create: { name: "Sarees", slug: "sarees" },
  });
  const dupattas = await prisma.category.upsert({
    where: { slug: "dupattas" },
    update: {},
    create: { name: "Dupattas", slug: "dupattas" },
  });

  const products = [
    { name: "Pen Kalamkari Peacock Motif Saree", price: 4500, discountPrice: 3800, categoryId: sarees.id, fabricType: "Cotton", stock: 12 },
    { name: "Block Print Kalamkari Tree of Life Saree", price: 3200, categoryId: sarees.id, fabricType: "Cotton", stock: 20 },
    { name: "Kalamkari Floral Dupatta", price: 1200, discountPrice: 950, categoryId: dupattas.id, fabricType: "Silk cotton", stock: 30 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: slugify(p.name, { lower: true, strict: true }) },
      update: {},
      create: {
        ...p,
        slug: slugify(p.name, { lower: true, strict: true }),
        description: `Handcrafted ${p.name} made using traditional Kalamkari techniques.`,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
