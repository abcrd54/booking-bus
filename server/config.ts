import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDir, "../.env") });
dotenv.config();

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const defaultEmailRedirectTo = "https://booking-bus-gold.vercel.app/auth/verified";

export const config = {
  port: Number(process.env.API_PORT ?? 8787),
  webOrigins: [
    ...(process.env.WEB_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  apiKeys: (process.env.APP_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
  supabase: {
    url: required("SUPABASE_URL"),
    anonKey: required("SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    emailRedirectTo: process.env.SUPABASE_EMAIL_REDIRECT_TO?.trim() || defaultEmailRedirectTo,
  },
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY?.trim() || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY?.trim() || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    finishRedirectUrl: process.env.MIDTRANS_FINISH_REDIRECT_URL?.trim() || "https://booking-bus-gold.vercel.app",
    finishRedirectUrlApp:
      process.env.MIDTRANS_FINISH_REDIRECT_URL_APP?.trim() || "majujaya://payment-finish",
  },
};
