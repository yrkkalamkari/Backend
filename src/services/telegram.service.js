// Sends a Telegram notification message to the shop owner every time a new order is placed.
//
// Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env.
// See docs/TELEGRAM_SETUP.md for provider configuration.

function formatOrderMessage(order) {
  const itemLines = order.items
    .map((item) => `• ${item.product.name} × ${item.qty} — ₹${item.priceAtPurchase}`)
    .join("\n");

  const addr = order.address;
  const addressLine = `${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}, ${addr.city}, ${addr.state} ${addr.pincode}`;

  return (
    `🛍️ *New order received!*\n\n` +
    `Order #${order.id.slice(0, 8)}\n` +
    `Customer: ${order.user.name} (${order.user.email}${order.user.phone ? ", " + order.user.phone : ""})\n\n` +
    `${itemLines}\n\n` +
    `Subtotal: ₹${order.subtotal}\n` +
    (Number(order.discountAmount) > 0 ? `Discount: −₹${order.discountAmount}\n` : "") +
    `*Total: ₹${order.total}*\n\n` +
    `Deliver to:\n${addressLine}${addr.phone ? `\nPhone: ${addr.phone}` : ""}`
  );
}

async function sendViaTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification.");
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null);

  if (!res.ok || !body || !body.ok) {
    const errorText = body?.description || await res.text().catch(() => "");
    throw new Error(`Telegram API request failed (${res.status}): ${errorText}`);
  }
}

// Fire-and-forget by design: a Telegram failure should NEVER fail the order.
// Call this without awaiting it in the controller, or await it wrapped in try/catch.
async function notifyAdminOfNewOrder(order) {
  try {
    const message = formatOrderMessage(order);
    await sendViaTelegram(message);
  } catch (err) {
    // Log and swallow — a notification failure must never break checkout.
    console.error("[telegram] Failed to send order notification:", err.message);
  }
}

module.exports = { notifyAdminOfNewOrder };
