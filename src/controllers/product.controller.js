const prisma = require("../config/db");

// GET /api/products?category=sarees&search=peacock&minPrice=500&maxPrice=5000&sort=price_asc&page=1&limit=20
async function listProducts(req, res, next) {
  try {
    const { category, search, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;

    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");

    const where = {
      isActive: true,
      ...(category && { category: { slug: category } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...((minPrice || maxPrice) && {
        price: {
          ...(minPrice && { gte: parseFloat(minPrice) }),
          ...(maxPrice && { lte: parseFloat(maxPrice) }),
        },
      }),
    };

    const orderBy =
      sort === "price_asc" ? { price: "asc" } :
      sort === "price_desc" ? { price: "desc" } :
      sort === "newest" ? { createdAt: "desc" } :
      { createdAt: "desc" };

    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          discountPrice: true,
          stock: true,
          images: { select: { url: true, isPrimary: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: Number(page), limit: take, totalPages: Math.ceil(total / take) });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:slug
async function getProduct(req, res, next) {
  try {
    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");

    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        stock: true,
        fabricType: true,
        category: { select: { name: true, slug: true } },
        images: { select: { id: true, url: true, isPrimary: true } },
      },
    });
    if (!product || !product.isActive) {
      return res.status(404).json({ error: "Product not found." });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// GET /api/categories
async function listCategories(req, res, next) {
  try {
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct, listCategories };
