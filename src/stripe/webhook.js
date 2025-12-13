import { stripe } from "./stripeClient.js";
import { supabaseServer } from "../lib/supabaseClient.js";

const PRICE_PAREJA = process.env.STRIPE_PRICE_PAREJA;
const PRICE_X = process.env.STRIPE_PRICE_X;

function planFromSubscription(sub) {
  const priceIds = (sub?.items?.data || [])
    .map((it) => it?.price?.id)
    .filter(Boolean);

  if (priceIds.includes(PRICE_X)) return "x";
  if (priceIds.includes(PRICE_PAREJA)) return "pareja";
  return "free";
}

async function updateProfileByUserId(userId, fields) {
  if (!userId) return;
  const { error } = await supabaseServer
    .from("profiles")
    .update({ ...fields, updated_at: new Date().toISOString?.() })
    .eq("id", userId);

  if (error) console.error("[stripe] supabase update error:", error);
}

async function updateProfileBySubscriptionId(subscriptionId, fields) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[stripe] supabase select error:", error);
    return;
  }
  if (!data?.id) return;

  await updateProfileByUserId(data.id, fields);
}

export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // RAW buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe] webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ✅ Cuando termina checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.client_reference_id || session.metadata?.userId;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const plan = planFromSubscription(sub);

      await updateProfileByUserId(userId, {
        plan,
        stripe_customer_id: customerId || null,
        stripe_subscription_id: subscriptionId || null,
        stripe_status: sub.status || null,
        stripe_current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      });
    }

    // ✅ Mantener sincronizado
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      const plan = planFromSubscription(sub);

      await updateProfileBySubscriptionId(sub.id, {
        plan: ["active", "trialing"].includes((sub.status || "").toLowerCase())
          ? plan
          : "free", // si deja de estar activo -> free
        stripe_customer_id: sub.customer || null,
        stripe_subscription_id: sub.id || null,
        stripe_status: sub.status || null,
        stripe_current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      });
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("[stripe] webhook handler error:", e);
    return res.status(500).send("Webhook handler failed");
  }
}
