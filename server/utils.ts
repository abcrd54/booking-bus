import type { Response } from "express";

export function sendSupabaseError(response: Response, error: unknown, fallback = "Supabase request failed") {
  const message = error instanceof Error ? error.message : fallback;

  return response.status(400).json({
    error: fallback,
    message,
  });
}
