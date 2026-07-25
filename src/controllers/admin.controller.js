const prisma = require("../config/db");
const cloudinary = require("../config/cloudinary");
const slugify = require("slugify");

// ---------- Products ----------

// POST /api/admin/products
async function createProduct(req, res, next) {
  try {
    const { name, description, price, discountPrice, stock, fabricType, categoryId } = req.body;
    if (!name || !description || !price || !categoryId) {
      return res.status(400).json({ error: "name, description, price, and categoryId are required." });
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug: slugify(name, { lower: true, strict: true }) + "-" + Date.now().toString(36),
        description,
        price,
        discountPrice: discountPrice || null,
        stock: stock ?? 0,
        fabricType,
        categoryId,
      },
    });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/products/:id
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, price, discountPrice, stock, fabricType, categoryId, isActive } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(price !== undefined && { price }),
        ...(discountPrice !== undefined && { discountPrice: discountPrice || null }),
        ...(stock !== undefined && { stock }),
        ...(fabricType !== undefined && { fabricType }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/products/:id
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const images = await prisma.productImage.findMany({ where: { productId: id } });

    // Best-effort cleanup of Cloudinary assets before removing the DB row
    for (const img of images) {
      if (img.publicId) {
        await cloudinary.uploader.destroy(img.publicId).catch(() => {});
      }
    }

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/products — includes inactive products too, for the admin panel
async function listAllProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        stock: true,
        fabricType: true,
        categoryId: true,
        isActive: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        images: {
          orderBy: { isPrimary: "desc" },
          select: { id: true, url: true, isPrimary: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/products/:id/images  (multipart/form-data, field name "image")
async function uploadProductImage(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image file uploaded." });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Product not found." });

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "kalamkari/products", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const existingCount = await prisma.productImage.count({ where: { productId: id } });

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        isPrimary: existingCount === 0, // first uploaded image becomes primary automatically
      },
    });
    res.status(201).json(image);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/products/:productId/images/:imageId
async function deleteProductImage(req, res, next) {
  try {
    const { imageId } = req.params;
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) return res.status(404).json({ error: "Image not found." });

    if (image.publicId) {
      await cloudinary.uploader.destroy(image.publicId).catch(() => {});
    }
    await prisma.productImage.delete({ where: { id: imageId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------- Categories ----------

// POST /api/admin/categories
async function createCategory(req, res, next) {
  try {
    const { name, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: "name is required." });

    const slug = slugify(name, { lower: true, strict: true });
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        imageUrl: imageUrl || null,
      },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/categories/:id
async function deleteCategory(req, res, next) {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------- Coupons ----------

// POST /api/admin/coupons
async function createCoupon(req, res, next) {
  try {
    const { code, discountType, value, minOrderValue, expiryDate, usageLimit } = req.body;
    if (!code || !discountType || value == null) {
      return res.status(400).json({ error: "code, discountType, and value are required." });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType, // "FLAT" | "PERCENT"
        value,
        minOrderValue: minOrderValue || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        usageLimit: usageLimit || null,
      },
    });
    res.status(201).json(coupon);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/coupons/:id
async function updateCoupon(req, res, next) {
  try {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(coupon);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/coupons
async function listCoupons(req, res, next) {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { code: "asc" } });
    res.json(coupons);
  } catch (err) {
    next(err);
  }
}

// ---------- Orders ----------

// GET /api/admin/orders
async function listAllOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        address: {
          select: {
            line1: true,
            city: true,
            state: true,
            pincode: true,
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/orders/:id/status  { status }
async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body; // PENDING | CONFIRMED | SHIPPED | DELIVERED | CANCELLED
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProduct, updateProduct, deleteProduct, listAllProducts,
  uploadProductImage, deleteProductImage,
  createCategory, deleteCategory,
  createCoupon, updateCoupon, listCoupons,
  listAllOrders, updateOrderStatus,
};
