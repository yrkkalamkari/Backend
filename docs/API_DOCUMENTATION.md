# Kalamkari store — API documentation

Base URL (local): `http://localhost:5000/api`
Base URL (production): `https://<your-backend-domain>/api`

## Authentication model

There are **no passwords anywhere in this system**. The only way to log in is Google Sign-In.

1. Frontend uses Google Identity Services to get a Google **ID token** for the signed-in user.
2. Frontend sends that ID token to `POST /api/auth/google`.
3. Backend verifies the token with Google, finds or creates the matching `User` row (matched on Google's stable `sub`/googleId), and returns **our own JWT**.
4. Frontend stores that JWT (e.g. in memory + localStorage) and sends it as `Authorization: Bearer <token>` on every request that needs auth.
5. Because the user is matched by `googleId`, logging in again on any device returns the *same* user row — their addresses, cart, and wishlist come back automatically. Nothing needs to be re-entered.

Endpoints marked 🔒 require the `Authorization: Bearer <token>` header.
Endpoints marked 🔒🛡️ additionally require `role = ADMIN` on that user.

---

## Auth

### `POST /api/auth/google`
Log in / sign up with Google. This is the only login endpoint in the app.

**Body**
```json
{ "idToken": "eyJhbGciOi..." }
```

**Response `200`**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "customer@gmail.com",
    "name": "Priya Rao",
    "avatarUrl": "https://lh3.googleusercontent.com/...",
    "phone": null,
    "role": "CUSTOMER"
  }
}
```

### `GET /api/auth/me` 🔒
Returns the full profile in one call — user info, all saved addresses, current cart, and wishlist. Call this right after login to hydrate the frontend.

**Response `200`**
```json
{
  "id": "uuid",
  "email": "customer@gmail.com",
  "name": "Priya Rao",
  "avatarUrl": "...",
  "phone": "9876543210",
  "role": "CUSTOMER",
  "addresses": [ { "id": "...", "line1": "...", "isDefault": true, ... } ],
  "cart": [ { "id": "...", "qty": 2, "product": { "name": "...", "images": [...] } } ],
  "wishlist": [ { "id": "...", "product": { ... } } ]
}
```

---

## User profile & addresses

### `PUT /api/users/me` 🔒
Body: `{ "name"?: string, "phone"?: string }`

### `GET /api/users/me/addresses` 🔒
Returns all saved addresses for the logged-in user, default address first.

### `POST /api/users/me/addresses` 🔒
Body:
```json
{ "label": "Home", "line1": "12 MG Road", "line2": "", "city": "Machilipatnam", "state": "Andhra Pradesh", "pincode": "521001", "country": "India", "isDefault": true }
```

### `PUT /api/users/me/addresses/:id` 🔒
Same body shape as above, all fields optional. Setting `isDefault: true` automatically unsets the previous default.

### `DELETE /api/users/me/addresses/:id` 🔒

---

## Products & categories (public — no login needed)

### `GET /api/products`
Query params (all optional): `category` (slug), `search`, `minPrice`, `maxPrice`, `sort` (`price_asc` | `price_desc` | default newest), `page`, `limit`.

**Response `200`**
```json
{ "products": [ { "id": "...", "name": "...", "price": "4500.00", "discountPrice": "3800.00", "images": [...] } ], "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
```

### `GET /api/products/:slug`
Full product detail including all images.

### `GET /api/categories`
List of all categories.

---

## Cart 🔒 (all endpoints require login)

### `GET /api/cart` — current user's cart with product details.
### `POST /api/cart` — Body: `{ "productId": "...", "qty": 1 }`. If already in cart, increases qty.
### `PUT /api/cart/:productId` — Body: `{ "qty": 3 }`. Sets an exact quantity.
### `DELETE /api/cart/:productId` — Remove one product from the cart.
### `DELETE /api/cart` — Empty the entire cart.

---

## Wishlist 🔒

### `GET /api/wishlist`
### `POST /api/wishlist` — Body: `{ "productId": "..." }`
### `DELETE /api/wishlist/:productId`

---

## Coupons

### `POST /api/coupons/validate` 🔒
Body: `{ "code": "WELCOME10", "cartTotal": 3800 }`
Returns the discount amount so the frontend can show it before checkout, without creating an order.

---

## Orders 🔒

### `POST /api/orders`
Checkout. Builds the order from the user's current cart server-side (never trusts prices sent by the client), validates stock, applies a coupon if given, decrements stock, records the coupon usage, and clears the cart — all atomically.

After the order is created, a Telegram message is sent to the shop owner with the order details (see `docs/TELEGRAM_SETUP.md`). This happens after the response is already sent to the customer, so a slow or failed notification send never delays or breaks checkout.

Body:
```json
{ "addressId": "uuid", "couponCode": "WELCOME10" }
```

### `GET /api/orders` — logged-in user's order history.
### `GET /api/orders/:id` — one order's detail (only if it belongs to the caller).

---

## Admin 🔒🛡️
All routes below require `role = ADMIN`. See `prisma/makeAdmin.js` for how to grant this to your account after your first Google login.

### Products
- `GET /api/admin/products` — includes inactive/out-of-stock products too.
- `POST /api/admin/products` — Body: `{ name, description, price, discountPrice?, stock, fabricType?, categoryId }`
- `PUT /api/admin/products/:id` — partial update, same fields, plus `isActive`.
- `DELETE /api/admin/products/:id` — also removes its images from Cloudinary.
- `POST /api/admin/products/:id/images` — `multipart/form-data`, field name `image`. Uploads to Cloudinary and attaches the URL to the product. First image uploaded becomes primary automatically.
- `DELETE /api/admin/products/:productId/images/:imageId`

### Categories
- `POST /api/admin/categories` — Body: `{ "name": "Bedspreads" }`
- `DELETE /api/admin/categories/:id`

### Coupons
- `GET /api/admin/coupons`
- `POST /api/admin/coupons` — Body: `{ "code": "DIWALI20", "discountType": "PERCENT", "value": 20, "minOrderValue": 1000, "expiryDate": "2026-11-01", "usageLimit": 100 }`
- `PUT /api/admin/coupons/:id`

### Orders
- `GET /api/admin/orders` — every order, with customer + address + items.
- `PUT /api/admin/orders/:id/status` — Body: `{ "status": "SHIPPED" }` (`PENDING`|`CONFIRMED`|`SHIPPED`|`DELIVERED`|`CANCELLED`)

---

## Error format

All errors return `{ "error": "human readable message" }` with an appropriate HTTP status code (400 bad input, 401 not authenticated, 403 not authorized, 404 not found, 409 conflict, 500 server error).
