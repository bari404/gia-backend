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

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, plan } = req.body; // plan: 'pareja' | 'x'
    const price = PRICE_BY_PLAN[plan];

    if (!userId || !price) return res.status(400).json({ error: "Bad request" });

    // Buscar perfil para reutilizar customer y evitar dobles suscripciones
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id, stripe_status, plan")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.error("[stripe] profile read error:", error);

    // Si ya tiene una suscripción activa -> mejor llevarlo al portal
    if (profile?.stripe_subscription_id && isActive(profile?.stripe_status)) {
      if (profile?.stripe_customer_id) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: `${process.env.FRONTEND_URL}/premium`,
        });
        return res.json({ url: portal.url, mode: "portal" });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/premium?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/premium?canceled=1`,
      client_reference_id: userId,
      metadata: { userId }, // no fiamos el plan aquí, el webhook lo deduce por price_id
      customer: profile?.stripe_customer_id || undefined,
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url, mode: "checkout" });
  } catch (e) {
    console.error("[stripe] create-checkout-session error:", e);
    return res.status(500).json({ error: "Stripe error" });
  }
});

router.post("/create-portal-session", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Bad request" });

    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer for this user" });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/premium`,
    });

    return res.json({ url: portal.url });
  } catch (e) {
    console.error("[stripe] create-portal-session error:", e);
    return res.status(500).json({ error: "Stripe error" });
  }
});

export default router;
