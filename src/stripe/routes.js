// backend/src/stripe/routes.js
import express from "express";
import { stripe } from "./stripeClient.js";
import { supabaseServer } from "../lib/supabaseClient.js";

const router = express.Router();

const PRICE_BY_PLAN = {
  pareja: process.env.STRIPE_PRICE_PAREJA,
  x: process.env.STRIPE_PRICE_X,
};

function isActive(status) {
  return ["active", "trialing"].includes((status || "").toLowerCase());
}

// ✅ Ping para comprobar que el router está montado
router.get("/ping", (req, res) => {
  res.json({ ok: true, where: "stripe/routes.js" });
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, plan } = req.body;
    const price = PRICE_BY_PLAN[plan];

    if (!userId || !price) {
      return res.status(400).json({ error: "Bad request (missing userId/plan)" });
    }

    // Reutilizar customer/sub si existe (evita múltiples subs)
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id, stripe_status")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.error("[stripe] supabase profile read error:", error);

    // Si ya tiene sub activa -> mandar al portal
    if (profile?.stripe_customer_id && profile?.stripe_subscription_id && isActive(profile?.stripe_status)) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.FRONTEND_URL}/`,
      });
      return res.json({ url: portal.url, mode: "portal" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/?canceled=1`,
      client_reference_id: userId,
      metadata: { userId },
      customer: profile?.stripe_customer_id || undefined,
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url, mode: "checkout" });
  } catch (e) {
    console.error("[stripe] create-checkout-session error:", e);
    return res.status(500).json({ error: "Stripe error" });
  }
});

export default router;
