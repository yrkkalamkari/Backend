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

  const stoles = await prisma.category.upsert({
    where: { slug: "stoles" },
    update: {},
    create: { name: "Stoles", slug: "stoles" },
  });

  const productsData = [
    {
      name: "Pen Kalamkari Peacock Motif Saree",
      price: 4500,
      discountPrice: 3800,
      categoryId: sarees.id,
      fabricType: "Cotton",
      stock: 12,
    },
    {
      name: "Block Print Kalamkari Tree of Life Saree",
      price: 3200,
      categoryId: sarees.id,
      fabricType: "Cotton",
      stock: 20,
    },
    {
      name: "Kalamkari Floral Dupatta",
      price: 1200,
      discountPrice: 950,
      categoryId: dupattas.id,
      fabricType: "Silk cotton",
      stock: 30,
    },
    {
      name: "Handloom Kalamkari Stole",
      price: 900,
      categoryId: stoles.id,
      fabricType: "Cotton",
      stock: 25,
    },
  ];

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { slug: slugify(p.name, { lower: true, strict: true }) },
      update: {},
      create: {
        ...p,
        slug: slugify(p.name, { lower: true, strict: true }),
        description: `Handcrafted ${p.name} made using traditional Kalamkari techniques.`,
      },
    });
    products.push(product);
  }

  const coupon = await prisma.coupon.upsert({
    where: { code: "SUMMER250" },
    update: {},
    create: {
      code: "SUMMER250",
      discountType: "FLAT",
      value: 250,
      minOrderValue: 2500,
      expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      usageLimit: 100,
    },
  });

  const user = await prisma.user.upsert({
    where: { googleId: "sample-google-id" },
    update: {
      name: "Sample Customer",
      email: "sample@kalamkari.test",
      phone: "9876543210",
      avatarUrl: "",
    },
    create: {
      googleId: "sample-google-id",
      email: "sample@kalamkari.test",
      name: "Sample Customer",
      phone: "9876543210",
      avatarUrl: "",
    },
  });

  const address = await prisma.address.upsert({
    where: { id: "sample-address-id" },
    update: {
      label: "Home",
      line1: "123 Kalamkari Street",
      line2: "Apt 4B",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      phone: "9876543210",
      isDefault: true,
      userId: user.id,
    },
    create: {
      id: "sample-address-id",
      userId: user.id,
      label: "Home",
      line1: "123 Kalamkari Street",
      line2: "Apt 4B",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      phone: "9876543210",
      isDefault: true,
    },
  });

  await prisma.order.upsert({
    where: { id: "sample-order-id" },
    update: {},
    create: {
      id: "sample-order-id",
      userId: user.id,
      addressId: address.id,
      subtotal: products[0].discountPrice || products[0].price + products[1].discountPrice || products[1].price,
      discountAmount: 250,
      total:
        (products[0].discountPrice || products[0].price) +
        (products[1].discountPrice || products[1].price) -
        250,
      couponId: coupon.id,
      items: {
        create: [
          {
            productId: products[0].id,
            qty: 1,
            priceAtPurchase: products[0].discountPrice || products[0].price,
          },
          {
            productId: products[1].id,
            qty: 1,
            priceAtPurchase: products[1].discountPrice || products[1].price,
          },
        ],
      },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
