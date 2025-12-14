// backend/src/stripe/routes.js
import express from "express";
import { stripe } from "./stripeClient.js";

const router = express.Router();

router.get("/ping", (req, res) => {
  res.json({ ok: true, where: "stripe/routes.js" });
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, plan } = req.body;

    const price =
      plan === "x"
        ? process.env.STRIPE_PRICE_X
        : plan === "pareja"
        ? process.env.STRIPE_PRICE_PAREJA
        : null;

    if (!userId || !price) {
      return res.status(400).json({ error: "missing userId or invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/?canceled=1`,
      client_reference_id: userId,
      metadata: { userId },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ error: "stripe_error" });
  }
});

export default router;
