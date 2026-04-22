import { Router } from "express";
import { z } from "zod";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import { supabaseAdmin, supabaseAuth } from "../supabase.js";
import { sendSupabaseError } from "../utils.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().min(6).optional(),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (request, response) => {
  const payload = registerSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid register payload", details: payload.error.flatten() });
  }

  const { email, password, name, phone, address } = payload.data;
  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, address },
    },
  });

  if (error || !data.user) {
    return sendSupabaseError(response, error, "Register failed");
  }

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    name,
    phone,
    address,
    role: "user",
  });

  return response.status(201).json({
    user: data.user,
    session: data.session,
  });
});

router.post("/login", async (request, response) => {
  const payload = loginSchema.safeParse(request.body);

  if (!payload.success) {
    return response.status(422).json({ error: "Invalid login payload", details: payload.error.flatten() });
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword(payload.data);

  if (error || !data.session) {
    return sendSupabaseError(response, error, "Login failed");
  }

  let { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,name,phone,address,role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return sendSupabaseError(response, profileError, "Profile lookup failed");
  }

  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: data.user.email ?? payload.data.email,
        name: data.user.user_metadata?.name ?? "",
        phone: data.user.user_metadata?.phone ?? "",
        address: data.user.user_metadata?.address ?? "",
        role: "user",
      })
      .select("id,email,name,phone,address,role")
      .single();

    if (createProfileError || !createdProfile) {
      return sendSupabaseError(response, createProfileError, "Profile creation failed");
    }

    profile = createdProfile;
  }

  return response.json({
    user: data.user,
    profile,
    session: data.session,
  });
});

router.get("/me", requireUser, async (request: AuthedRequest, response) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,name,phone,address,role,created_at")
    .eq("id", request.user!.id)
    .single();

  if (error) {
    return sendSupabaseError(response, error, "Profile lookup failed");
  }

  return response.json({ profile: data });
});

router.post("/logout", requireUser, async (_request, response) => {
  return response.json({ ok: true });
});

export default router;
