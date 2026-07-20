// Sends a WhatsApp message to the store owner every time a new order is placed.
//
// Default provider: CallMeBot — free, takes 2 minutes to set up, but can only
// send to ONE fixed phone number (yours). That's exactly what's needed here:
// notifying the shop owner, not messaging customers. See docs/WHATSAPP_SETUP.md.
//
// If you outgrow that (e.g. you also want automated "order confirmed" messages
// TO customers), swap in the Meta WhatsApp Cloud API — a stub for that is
// included below and only needs its own env vars filled in.

const PROVIDER = process.env.WHATSAPP_PROVIDER || "callmebot"; // "callmebot" | "meta" | "none"

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
    `Deliver to:\n${addressLine}`
  );
}

async function sendViaCallMeBot(message) {
  const phone = process.env.WHATSAPP_ADMIN_PHONE; // your number, with country code, no + or spaces, e.g. 919876543210
  const apiKey = process.env.WHATSAPP_CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    console.warn("[whatsapp] WHATSAPP_ADMIN_PHONE or WHATSAPP_CALLMEBOT_APIKEY not set — skipping notification.");
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CallMeBot request failed (${res.status}): ${text}`);
  }
}

async function sendViaMetaCloudApi(message) {
  // Requires: WHATSAPP_META_PHONE_NUMBER_ID, WHATSAPP_META_ACCESS_TOKEN, WHATSAPP_ADMIN_PHONE
  // (admin phone in international format WITHOUT '+', e.g. 919876543210)
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_ADMIN_PHONE;

  if (!phoneNumberId || !accessToken || !to) {
    console.warn("[whatsapp] Meta Cloud API env vars not set — skipping notification.");
    return;
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta WhatsApp API request failed (${res.status}): ${text}`);
  }
}

// Fire-and-forget by design: a WhatsApp failure should NEVER fail the order.
// Call this without awaiting it in the controller, or await it wrapped in try/catch.
async function notifyAdminOfNewOrder(order) {
  if (PROVIDER === "none") return;

  try {
    const message = formatOrderMessage(order);
    if (PROVIDER === "meta") {
      await sendViaMetaCloudApi(message);
    } else {
      await sendViaCallMeBot(message);
    }
  } catch (err) {
    // Log and swallow — a notification failure must never break checkout.
    console.error("[whatsapp] Failed to send order notification:", err.message);
  }
}

module.exports = { notifyAdminOfNewOrder };
