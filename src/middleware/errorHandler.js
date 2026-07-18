function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "P2002") {
    // Prisma unique constraint violation
    return res.status(409).json({ error: `Duplicate value for field: ${err.meta?.target}` });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found." });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error." });
}

module.exports = errorHandler;
