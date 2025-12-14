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

// ✅ Crear sesión de Stripe Customer Portal
router.post("/create-portal-session", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "missing_userId" });

    // Leer customer_id desde Supabase
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[portal] supabase read error:", error);
      return res.status(500).json({ error: "supabase_error" });
    }

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: "no_customer" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/`,
    });

    return res.json({ url: portalSession.url });
  } catch (e) {
    console.error("[portal] error:", e);
    return res.status(500).json({ error: "portal_error", message: e?.message });
  }
});

export default router;

