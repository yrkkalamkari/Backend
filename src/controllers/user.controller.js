const prisma = require("../config/db");

// PUT /api/users/me — update name / phone
async function updateMe(req, res, next) {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// GET /api/users/me/addresses
async function listAddresses(req, res, next) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { isDefault: "desc" },
    });
    res.json(addresses);
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/addresses
async function createAddress(req, res, next) {
  try {
    const { label, line1, line2, city, state, pincode, country, phone, isDefault } = req.body;
    if (!line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: "line1, city, state, and pincode are required." });
    }

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.create({
      data: { userId: req.user.id, label, line1, line2, city, state, pincode, country, phone, isDefault: !!isDefault },
    });
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/me/addresses/:id
async function updateAddress(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: "Address not found." });

    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.update({ where: { id }, data: req.body });
    res.json(address);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/me/addresses/:id
async function deleteAddress(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: "Address not found." });

    // Prevent deleting an address that is referenced by existing orders
    const ordersUsing = await prisma.order.count({ where: { addressId: id } });
    if (ordersUsing > 0) {
      return res.status(400).json({ error: "Address cannot be deleted because it is used by existing orders." });
    }

    await prisma.address.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { updateMe, listAddresses, createAddress, updateAddress, deleteAddress };
