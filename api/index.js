import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSchema, pool } from "./db.js";
import { requireAuth } from "./middleware/requireAuth.js";
import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import categoryRoutes from "./routes/categories.js";
import transactionRoutes from "./routes/transactions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret =
  process.env.SESSION_SECRET || "development-secret-change-this-immediately";

if (
  isProduction &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
) {
  throw new Error(
    "SESSION_SECRET wajib diisi minimal 32 karakter saat NODE_ENV=production."
  );
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    name: process.env.SESSION_COOKIE_NAME || "sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.COOKIE_SECURE === undefined
          ? isProduction
          : process.env.COOKIE_SECURE === "true",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "Success" });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", requireAuth, accountRoutes);
app.use("/api/categories", requireAuth, categoryRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    status: "Error",
    message: "Endpoint tidak ditemukan.",
  });
});

const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.method !== "GET") return next();

  res.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      status: "Error",
      message: "Body JSON tidak valid.",
    });
  }

  console.error(error);
  return res.status(500).json({
    status: "Error",
    message: isProduction
      ? "Terjadi kesalahan pada server."
      : error.message || "Terjadi kesalahan pada server.",
  });
});

async function start() {
  await ensureSchema();

  if (!process.env.VERCEL) {
    const port = Number(process.env.PORT || 5000);
    app.listen(port, () => {
      console.log(`Backend berjalan di http://localhost:${port}`);
    });
  }
}

start().catch((error) => {
  console.error("Gagal menjalankan server:", error);
  process.exit(1);
});

export default app;
