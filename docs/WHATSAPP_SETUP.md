# WhatsApp order notifications — setup

When a customer places an order, the backend sends a WhatsApp message to **the shop owner** (not the customer) with the order details, so you know to pack and ship without needing to check the admin panel constantly.

## Option A — CallMeBot (default, free, 2-minute setup)

CallMeBot is a free service that lets you send WhatsApp messages **from your own number to yourself** via a simple API call. Perfect fit here: you don't need customers to receive anything, you just need to know a new order came in.

1. Save this contact on your phone: **+34 644 59 71 67** (this is CallMeBot's number, not a scam — it's a widely used free utility).
2. From WhatsApp, send this exact message to that number: `I allow callmebot to send me messages`
3. Wait for a reply — it will contain your personal **API key** (a number).
4. In your backend `.env`:
   ```
   WHATSAPP_PROVIDER=callmebot
   WHATSAPP_ADMIN_PHONE=91XXXXXXXXXX     # your number, country code, no + or spaces
   WHATSAPP_CALLMEBOT_APIKEY=123456      # the key CallMeBot sent you
   ```
5. Place a test order — you should get a WhatsApp message within a few seconds.

**Limitations:** CallMeBot is a free community tool, not an official WhatsApp Business product — it can occasionally be slow or rate-limited, and it only sends to the one number you registered. That's fine for "notify the shop owner," but don't build customer-facing order confirmations on it.

## Option B — Meta WhatsApp Cloud API (official, for scaling later)

If you outgrow CallMeBot or want to send official order-confirmation messages **to customers** too, switch to Meta's own WhatsApp Cloud API:

1. Create a Meta developer account and a WhatsApp Business app at [developers.facebook.com](https://developers.facebook.com).
2. Get a phone number ID and a temporary (then permanent) access token from the app dashboard.
3. Set in `.env`:
   ```
   WHATSAPP_PROVIDER=meta
   WHATSAPP_META_PHONE_NUMBER_ID=...
   WHATSAPP_META_ACCESS_TOKEN=...
   WHATSAPP_ADMIN_PHONE=91XXXXXXXXXX
   ```
4. Note: sending messages to numbers that haven't messaged your business first requires pre-approved **message templates** (Meta's policy, not this code's limitation) — free-form text only works within a 24-hour window after the customer messages you first. This is why CallMeBot (sending only to yourself) is the simpler starting point.

## Turning it off

Set `WHATSAPP_PROVIDER=none` in `.env` and no notification is attempted — checkout is completely unaffected either way, since the WhatsApp call happens *after* the order response is already sent to the customer and any failure is only logged, never surfaced as an error.
