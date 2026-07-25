# Telegram order notifications — setup

When a customer places an order, the backend sends a Telegram message to **the shop owner** with the order details, so you know to pack and ship without needing to check the admin panel constantly.

## Telegram bot setup

1. Create a Telegram bot by messaging [@BotFather](https://t.me/BotFather) and sending `/newbot`.
2. Choose a name and username for your bot.
3. Copy the bot token that BotFather gives you.
4. Start a chat with your bot and send it any message.
5. Get your chat ID by using the bot API:
   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Then find `chat.id` in the JSON response.
6. In your backend `.env`:
   ```text
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   TELEGRAM_CHAT_ID=your-chat-id
   ```
7. Restart the backend and place a test order.

If the bot token or chat ID is missing, the backend will skip notification and still complete checkout normally.

## Notes

- The message is sent after the order is created and after the response is sent to the customer.
- Notification failures are logged, but they do not stop checkout.
