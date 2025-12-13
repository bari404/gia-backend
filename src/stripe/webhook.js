import { stripe } from "./stripeClient.js";
import { supabaseServer } from "../lib/supabaseClient.js";

async function upsertProfileStripe({ userId, plan, customerId, sub }) {
  await supabaseServer
    .from("profiles")
    .update({
      plan: plan || "free",
      stripe_customer_id: customerId || null,
      stripe_subscription_id: sub?.id || null,
      stripe_status: sub?.status || null,
      stripe_current_period_end: sub?.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("id", userId);
}

export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe] bad signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.client_reference_id || session.metadata?.userId;
      const plan = session.metadata?.plan; // 'pareja' | 'x'
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      await upsertProfileStripe({ userId, plan, customerId, sub });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;

      // buscamos el user por stripe_subscription_id
      const { data: profile } = await supabaseServer
        .from("profiles")
        .select("id, plan")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (profile?.id) {
        // si se cancela / no está activo, puedes dejar plan pero el check usará stripe_status
        await upsertProfileStripe({
          userId: profile.id,
          plan: profile.plan,
          customerId: sub.customer,
          sub,
        });
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("[stripe] webhook handler error:", e);
    res.status(500).send("Webhook handler failed");
  }
}
