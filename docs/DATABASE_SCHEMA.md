# Database schema

Source of truth is `prisma/schema.prisma` — this file explains it in plain English.
Database engine: **PostgreSQL** (works on Supabase, Render Postgres, Railway, Neon, or your own instance).

## Tables

### `User`
One row per person, created automatically on their first Google login. **No password field exists.**
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| googleId | string, unique | Google's stable `sub` claim — this is what re-identifies the person on every future login |
| email | string, unique | from Google |
| name | string | from Google, refreshed on each login |
| avatarUrl | string, nullable | Google profile photo |
| phone | string, nullable | filled in later by the user |
| role | enum: CUSTOMER, ADMIN | default CUSTOMER |
| createdAt | datetime | |

### `Address`
A user can have multiple saved addresses; one can be marked default.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| userId | uuid | FK → User |
| label | string, nullable | "Home", "Office" |
| line1, line2, city, state, pincode, country | string | |
| isDefault | boolean | only one true per user, enforced in application code |

### `Category`
| id | name | slug (unique, used in URLs) |

### `Product`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name, slug (unique) | string | |
| description | text | |
| price | decimal(10,2) | |
| discountPrice | decimal(10,2), nullable | if set, this is the price shown/charged |
| stock | int | decremented on checkout |
| fabricType | string, nullable | e.g. "Cotton", "Silk cotton" |
| isActive | boolean | soft-delete flag; inactive products are hidden from public listing |
| categoryId | uuid | FK → Category |

### `ProductImage`
One product → many images. `isPrimary` marks the main thumbnail.
| id | productId (FK) | url | publicId (Cloudinary ID, used to delete the asset later) | isPrimary |

### `CartItem`
Persistent server-side cart, one row per (user, product) — **unique constraint on `[userId, productId]`** so re-adding the same product just bumps quantity instead of duplicating rows. This is what makes the cart "come back" when a user logs in on a new device.
| id | userId (FK) | productId (FK) | qty | createdAt |

### `WishlistItem`
Same shape and same reasoning as CartItem, unique on `[userId, productId]`.
| id | userId (FK) | productId (FK) | createdAt |

### `Coupon`
| Column | Type | Notes |
|---|---|---|
| code | string, unique | stored upper-cased |
| discountType | enum: FLAT, PERCENT | |
| value | decimal | flat rupee amount or percent, depending on discountType |
| minOrderValue | decimal, nullable | |
| expiryDate | datetime, nullable | |
| usageLimit | int, nullable | total redemptions allowed across all users |
| timesUsed | int | incremented on every successful order that uses it |
| isActive | boolean | admin kill-switch |

### `Order`
Snapshot of a completed checkout — never recalculated from live product prices after creation.
| Column | Type | Notes |
|---|---|---|
| userId | FK | |
| addressId | FK | which saved address it shipped to |
| status | enum: PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED | |
| subtotal, discountAmount, total | decimal | computed at checkout time |
| couponId | FK, nullable | |
| paymentStatus | enum: UNPAID, PAID, FAILED, REFUNDED | |
| razorpayOrderId | string, nullable | for payment gateway reconciliation |

### `OrderItem`
Line items — **stores `priceAtPurchase`** so historical orders stay accurate even if the product's price changes later.
| id | orderId (FK) | productId (FK) | qty | priceAtPurchase |

## Entity relationships

```
User 1───* Address
User 1───* CartItem      *───1 Product
User 1───* WishlistItem  *───1 Product
User 1───* Order 1───* OrderItem *───1 Product
Order *───1 Address
Order *───0..1 Coupon
Category 1───* Product 1───* ProductImage
```

## Why this design solves your requirement

You asked: *"if the user logs in again, their address, wishlist, cart details — everything should show up."*

That works because every one of those tables (`Address`, `CartItem`, `WishlistItem`, `Order`) is keyed off `userId`, and `userId` is permanently tied to `googleId` — not to a session or a device. Google login always resolves to the same `User` row, so `GET /api/auth/me` always returns the same saved state, on any device, forever (until the user deletes it).

## Applying the schema

```bash
npx prisma migrate dev --name init   # creates tables in your database
npx prisma generate                  # generates the JS client
node prisma/seed.js                  # optional: adds sample categories/products
```
