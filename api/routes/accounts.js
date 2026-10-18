import { Router } from "express";
import { pool } from "../db.js";

const router = Router();
const ALLOWED_TYPES = new Set(["bank", "cash", "ewallet", "other"]);

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, type FROM accounts WHERE user_id = $1 ORDER BY id",
    [req.userId]
  );

  return res.json({ status: "Success", data: result.rows });
});

router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const type = String(req.body?.type || "other").trim().toLowerCase();

  if (name.length < 1 || name.length > 40) {
    return res.status(400).json({
      status: "Error",
      message: "Nama rekening harus diisi dan maksimal 40 karakter.",
    });
  }

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({
      status: "Error",
      message: "Tipe rekening tidak valid.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, name, type)
       VALUES ($1, $2, $3)
       RETURNING id, name, type`,
      [req.userId, name, type]
    );

    return res.status(201).json({ status: "Success", data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        status: "Error",
        message: "Rekening dengan nama tersebut sudah ada.",
      });
    }
    throw error;
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: "Error",
      message: "ID rekening tidak valid.",
    });
  }

  const result = await pool.query(
    "DELETE FROM accounts WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Rekening tidak ditemukan.",
    });
  }

  return res.json({ status: "Success" });
});

export default router;
