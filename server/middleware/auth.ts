import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin, supabaseForUser } from "../supabase";

export type AuthedRequest = Request & {
  accessToken?: string;
  user?: {
    id: string;
    email?: string;
    role?: "admin" | "user";
  };
};

function getBearerToken(request: Request) {
  const header = request.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

export async function requireUser(request: AuthedRequest, response: Response, next: NextFunction) {
  const token = getBearerToken(request);

  if (!token) {
    return response.status(401).json({ error: "Bearer token required" });
  }

  const userClient = supabaseForUser(token);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    return response.status(401).json({ error: "Invalid bearer token" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    return response.status(403).json({ error: "Profile not found" });
  }

  request.accessToken = token;
  request.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
  };

  return next();
}

export async function requireAdmin(request: AuthedRequest, response: Response, next: NextFunction) {
  await requireUser(request, response, () => {
    if (request.user?.role !== "admin") {
      return response.status(403).json({ error: "Admin role required" });
    }

    return next();
  });
}
