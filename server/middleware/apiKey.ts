import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireApiKey(request: Request, response: Response, next: NextFunction) {
  const origin = request.header("origin");
  const referer = request.header("referer");
  const isTrustedWebsite =
    Boolean(origin && config.webOrigins.includes(origin)) ||
    Boolean(referer && config.webOrigins.some((webOrigin) => referer.startsWith(webOrigin)));

  if (isTrustedWebsite) {
    return next();
  }

  const apiKey = request.header("x-api-key");

  if (!apiKey || config.apiKeys.length === 0) {
    return response.status(401).json({
      error: "API key required",
      message: "Send a valid x-api-key header.",
    });
  }

  const allowed = config.apiKeys.some((registeredKey) => safeEqual(apiKey, registeredKey));

  if (!allowed) {
    return response.status(403).json({
      error: "Invalid API key",
    });
  }

  return next();
}
