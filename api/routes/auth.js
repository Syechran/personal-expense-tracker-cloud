import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  pool,
  withTransaction,
} from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/;
const MAX_AVATAR_BYTES = 512 * 1024;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-password", 10);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 10 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
  },
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
  };
}

function normalizeAvatar(value) {
  if (value === null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, message: "Format foto tidak didukung." };
  }

  const match = value.match(AVATAR_PATTERN);

  if (!match) {
    return {
      ok: false,
      message: "Foto harus berupa data URL PNG, JPEG, atau WebP.",
    };
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");

  if (buffer.length === 0) {
    return { ok: false, message: "File foto kosong." };
  }

  if (buffer.length > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      message: "Ukuran foto maksimal 512 KB setelah dikompres.",
    };
  }

  const isPng =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  const contentMatches =
    (mime === "png" && isPng) ||
    (mime === "jpeg" && isJpeg) ||
    (mime === "webp" && isWebp);

  if (!contentMatches) {
    return { ok: false, message: "Isi file foto tidak valid." };
  }

  return {
    ok: true,
    value: `data:image/${mime};base64,${buffer.toString("base64")}`,
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

router.post("/register", authLimiter, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (name.length < 1 || name.length > 60) {
    return res.status(400).json({
      status: "Error",
      message: "Nama harus diisi dan maksimal 60 karakter.",
    });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    return res.status(400).json({
      status: "Error",
      message: "Format email tidak valid.",
    });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      status: "Error",
      message: "Password harus terdiri dari 8 sampai 128 karakter.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, avatar`,
        [email, name, passwordHash]
      );
      const createdUser = inserted.rows[0];

      for (const account of DEFAULT_ACCOUNTS) {
        await client.query(
          "INSERT INTO accounts (user_id, name, type) VALUES ($1, $2, $3)",
          [createdUser.id, account.name, account.type]
        );
      }

      for (const category of DEFAULT_CATEGORIES) {
        await client.query(
          "INSERT INTO categories (user_id, name) VALUES ($1, $2)",
          [createdUser.id, category]
        );
      }

      return createdUser;
    });

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    return res.status(201).json({ status: "Success", data: publicUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        status: "Error",
        message: "Email sudah terdaftar.",
      });
    }
    throw error;
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({
      status: "Error",
      message: "Email dan password wajib diisi.",
    });
  }

  const result = await pool.query(
    "SELECT id, name, email, avatar, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    return res.status(401).json({
      status: "Error",
      message: "Email atau password salah.",
    });
  }

  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  return res.json({ status: "Success", data: publicUser(user) });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        status: "Error",
        message: "Gagal keluar dari sesi.",
      });
    }

    res.clearCookie(process.env.SESSION_COOKIE_NAME || "sid");
    return res.json({ status: "Success" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, email, avatar FROM users WHERE id = $1",
    [req.userId]
  );

  if (result.rowCount === 0) {
    req.session.destroy(() => {});
    return res.status(401).json({
      status: "Error",
      message: "Sesi tidak valid. Silakan masuk kembali.",
    });
  }

  return res.json({ status: "Success", data: publicUser(result.rows[0]) });
});

router.patch("/me", requireAuth, async (req, res) => {
  const body = req.body || {};
  const result = await pool.query(
    "SELECT id, name, email, avatar FROM users WHERE id = $1",
    [req.userId]
  );

  if (result.rowCount === 0) {
    req.session.destroy(() => {});
    return res.status(401).json({
      status: "Error",
      message: "Sesi tidak valid. Silakan masuk kembali.",
    });
  }

  const current = result.rows[0];
  let name = current.name;
  let avatar = current.avatar || null;

  if (body.name !== undefined) {
    name = String(body.name || "").trim();

    if (name.length < 1 || name.length > 60) {
      return res.status(400).json({
        status: "Error",
        message: "Nama harus diisi dan maksimal 60 karakter.",
      });
    }
  }

  if (body.avatar !== undefined) {
    const parsedAvatar = normalizeAvatar(body.avatar);

    if (!parsedAvatar.ok) {
      return res.status(400).json({
        status: "Error",
        message: parsedAvatar.message,
      });
    }

    avatar = parsedAvatar.value;
  }

  if (body.name === undefined && body.avatar === undefined) {
    return res.status(400).json({
      status: "Error",
      message: "Tidak ada data yang diubah.",
    });
  }

  await pool.query(
    "UPDATE users SET name = $1, avatar = $2 WHERE id = $3",
    [name, avatar, req.userId]
  );

  return res.json({
    status: "Success",
    data: publicUser({ ...current, name, avatar }),
  });
});

export default router;
