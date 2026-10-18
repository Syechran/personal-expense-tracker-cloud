import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT id, name FROM categories WHERE user_id = $1 ORDER BY id",
    [req.userId]
  );

  return res.json({ status: "Success", data: result.rows });
});

router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim();

  if (name.length < 1 || name.length > 40) {
    return res.status(400).json({
      status: "Error",
      message: "Nama kategori harus diisi dan maksimal 40 karakter.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (user_id, name)
       VALUES ($1, $2)
       RETURNING id, name`,
      [req.userId, name]
    );

    return res.status(201).json({ status: "Success", data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        status: "Error",
        message: "Kategori dengan nama tersebut sudah ada.",
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
      message: "ID kategori tidak valid.",
    });
  }

  const result = await pool.query(
    "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Kategori tidak ditemukan.",
    });
  }

  return res.json({ status: "Success" });
});

export default router;
