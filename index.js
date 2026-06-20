require("dotenv").config();
const { supabase } = require("./whatDb");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");
const { configDotenv } = require("dotenv");
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = "";

// 3. WHATSAPP BOT LOGIC
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Prevents memory limitations from crashing headless Chrome
      "--disable-accelerated-2d-canvas",
      "--disable-gpu", // Disables hardware rendering engine allocation
    ],
  },
});

// 2. EXPRESS ROUTES FOR FREE HOSTING & QR VISIBILITY
app.get("/", (req, res) => {
  if (!qrCodeData) {
    res.send(
      "<h1>Bot is running! Already authenticated or waiting for QR...</h1>"
    );
  } else {
    qrcode.toDataURL(qrCodeData, (err, url) => {
      res.send(
        `<h1>Scan this QR code to connect your WhatsApp:</h1><img src="${url}"/>`
      );
    });
  }
});

app.get("/health", async (req, res) => {
  const dbCheck = await supabase
    .from("WhatMarket")
    .select("product_id")
    .limit(1);

  res.status(200).json({
    uptime: process.uptime(),
    db: !dbCheck.error,
    whatsapp: !!client.info,
  });
});

app.listen(port, () => console.log(`Server listening on port ${port}`));

client.on("qr", (qr) => {
  qrCodeData = qr;
  console.log("QR Code received, view it on your Express index page.");
});

client.on("ready", () => {
  qrCodeData = "";
  console.log("WhatsApp Bot is fully connected and ready!");
});

// 4. CHAT AND INVENTORY LOOKUP LOGIC
client.on("message", async (msg) => {
  const text = msg.body.trim().toLowerCase();

  try {
    await msg.react("👍");
  } catch {}

  const helpMessage = `
🤖 *Calabar Market Bot*

You can ask in any of these ways:

product:rice
rice
how much is rice
price of rice
do you have rice
find rice

Examples:
product:rice
how much is indomie

More features coming soon 🚀
`;

  // Help commands
  if (["help", "hi", "hello", "start"].includes(text)) {
    return msg.reply(helpMessage);
  }

  let productQuery = null;

  // Explicit command
  if (text.startsWith("product:")) {
    productQuery = text.replace("product:", "").trim();
  }

  // Natural language mode
  if (!productQuery) {
    const stopWords = [
      "how",
      "much",
      "is",
      "the",
      "price",
      "of",
      "do",
      "you",
      "have",
      "find",
      "get",
      "need",
      "want",
      "show",
      "me",
      "for",
      "a",
      "an",
      "any",
      "available",
      "stock",
      "cost",
      "what",
      "does",
    ];

    const words = text.split(/\s+/).filter((word) => !stopWords.includes(word));

    productQuery = words.join(" ").trim();
  }

  if (!productQuery) {
    return msg.reply(helpMessage);
  }

  try {
    const { data, error } = await supabase
      .from("WhatMarket")
      .select("*")
      .ilike("name", `%${productQuery}%`)
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return msg.reply(
        `❌ No products found for "${productQuery}"

Try:
product:rice
how much is rice
price of indomie

Or type *help*.`
      );
    }

    let response = "📦 *Products Found*\n\n";

    data.forEach((item, index) => {
      response += `${index + 1}. *${item.name}*\n`;
      response += `💰 ₦${item.current_price_ngn}\n`;

      if (item.market_name) {
        response += `🏪 ${item.market_name}\n`;
      }

      response += "\n";
    });

    return msg.reply(response);
  } catch (err) {
    console.error("Supabase Error:", err);

    return msg.reply(
      "⚠️ Unable to fetch product data right now. Please try again later."
    );
  }
});

client.on("disconnected", async (reason) => {
  console.log("WhatsApp disconnected:", reason);

  try {
    await client.destroy();
    await client.initialize();
  } catch (err) {
    console.error(err);
  }
});

client.on("auth_failure", (msg) => {
  console.error("AUTH FAILURE:", msg);
});

client.initialize();
