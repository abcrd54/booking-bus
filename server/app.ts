import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { requireApiKey } from "./middleware/apiKey.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import publicRoutes from "./routes/public.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.webOrigins,
    credentials: true,
    allowedHeaders: ["content-type", "authorization", "x-api-key"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "maju-jaya-api" });
});

app.use("/api/v1", requireApiKey);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", publicRoutes);
app.use("/api/v1", bookingRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});
