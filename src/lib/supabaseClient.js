// backend/src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({
  path: "C:/Users/lluis/Desktop/ia-starter/backend/.env",
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("[supabaseClient] URL:", supabaseUrl ? "OK" : "❌ FALTA");
console.log("[supabaseClient] SERVICE ROLE:", supabaseServiceKey ? "OK" : "❌ FALTA");

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});
