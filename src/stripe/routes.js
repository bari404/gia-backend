import express from "express";
import { stripe } from "./stripeClient.js";

const router = express.Router();

const PRICE_BY_PLAN = {
  pareja: process.env.STRIPE_PRICE_PAREJA,
  x: process.env.STRIPE_PRICE_X,
};

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, plan } = req.body;
    const price = PRICE_BY_PLAN[plan];
    if (!userId || !price) return res.status(400).json({ error: "Bad request" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/premium?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/premium?canceled=1`,
      client_reference_id: userId,
      metadata: { userId, plan },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] checkout error:", e);
    res.status(500).json({ error: "Stripe error" });
  }
});

export default router;
