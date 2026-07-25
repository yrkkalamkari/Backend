require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const couponRoutes = require("./routes/coupon.routes");
const orderRoutes = require("./routes/order.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.method !== "GET") return next();

  if (req.path.startsWith("/api/categories")) {
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  } else if (req.path.startsWith("/api/products")) {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  }

  next();
});

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", productRoutes); // exposes /api/products and /api/categories
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
app.use(errorHandler);

module.exports = app;
