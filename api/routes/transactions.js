import { Router } from "express";
import writeExcelFile from "write-excel-file/node";
import { pool } from "../db.js";

const router = Router();
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TRANSACTION_FIELDS = `
  t.id,
  t.title,
  t.amount,
  t.report,
  t.note,
  t.account_id,
  t.category_id,
  to_char(t.date, 'YYYY-MM-DD') AS date_iso,
  COALESCE(a.name, 'Tanpa Rekening') AS account_name,
  COALESCE(c.name, 'Other') AS category_name
`;

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function mapTransaction(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.account_name,
    amount: row.amount,
    date: formatDate(row.date_iso),
    dateISO: row.date_iso,
    category: row.category_name,
    report: row.report,
    balance: row.account_name,
    note: row.note,
    accountId: row.account_id,
    categoryId: row.category_id,
  };
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/[^\d.-]/g, ""));
}

function normalizeDate(value) {
  const text = String(value || "").trim();

  if (!DATE_PATTERN.test(text)) return null;

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return text;
}

function normalizeReport(value, fallback = "Expenses") {
  const report = String(value || "").trim().toLowerCase();

  if (report === "income") return "Income";
  if (report === "expense" || report === "expenses") return "Expenses";

  return fallback;
}

async function findOwnedId(table, id, userId) {
  const result = await pool.query(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rowCount > 0;
}

async function getTransaction(id, userId) {
  const result = await pool.query(
    `SELECT ${TRANSACTION_FIELDS}
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );

  return result.rows[0] ? mapTransaction(result.rows[0]) : null;
}

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT ${TRANSACTION_FIELDS}
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.user_id = $1
     ORDER BY t.date DESC, t.id DESC`,
    [req.userId]
  );

  return res.json({
    status: "Success",
    data: result.rows.map(mapTransaction),
  });
});

router.get("/export", async (req, res) => {
  const days = Number(req.query.days || 30);

  if (![7, 30].includes(days)) {
    return res.status(400).json({
      status: "Error",
      message: "Rentang export harus 7 atau 30 hari.",
    });
  }

  const result = await pool.query(
    `SELECT
       t.title,
       t.amount,
       t.report,
       t.note,
       to_char(t.date, 'YYYY-MM-DD') AS date_iso,
       COALESCE(a.name, 'Tanpa Rekening') AS account_name,
       COALESCE(c.name, 'Other') AS category_name
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.date >= CURRENT_DATE - ($2::int - 1)
     ORDER BY t.date ASC, t.id ASC`,
    [req.userId, days]
  );

  const headerCell = (value) => ({
    value,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    align: "center",
  });

  const rows = result.rows.map((row) => {
    const [year, month, day] = row.date_iso.split("-").map(Number);

    return [
      {
        value: new Date(Date.UTC(year, month - 1, day)),
        type: Date,
        format: "yyyy-mm-dd",
      },
      row.title,
      row.category_name,
      row.account_name,
      row.report === "Income" ? "Pemasukan" : "Pengeluaran",
      { value: Math.abs(row.amount), type: Number, format: "#,##0" },
      row.note || "",
    ];
  });

  const sheetData = [
    [
      headerCell("Tanggal"),
      headerCell("Keterangan"),
      headerCell("Kategori"),
      headerCell("Rekening"),
      headerCell("Jenis"),
      headerCell("Nominal"),
      headerCell("Catatan"),
    ],
    ...rows,
  ];

  const buffer = await writeExcelFile(sheetData, {
    sheet: "Transaksi",
    columns: [
      { width: 14 },
      { width: 30 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 16 },
      { width: 30 },
    ],
    stickyRowsCount: 1,
  }).toBuffer();

  const filename = `transaksi-${days}hari-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "no-store");
  return res.end(buffer);
});

router.post("/", async (req, res) => {
  const rawAmount = parseAmount(req.body?.amount);
  const report = normalizeReport(req.body?.report);
  const amount = Math.trunc(rawAmount);
  const title = String(req.body?.title || "").trim() || "Tanpa Keterangan";
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 500) : null;
  const accountId =
    req.body?.accountId === null || req.body?.accountId === undefined
      ? null
      : Number(req.body.accountId);
  const categoryId =
    req.body?.categoryId === null || req.body?.categoryId === undefined
      ? null
      : Number(req.body.categoryId);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      status: "Error",
      message: "Nominal harus berupa angka lebih dari 0.",
    });
  }

  if (title.length > 120) {
    return res.status(400).json({
      status: "Error",
      message: "Keterangan maksimal 120 karakter.",
    });
  }

  let date = null;
  if (req.body?.date) {
    date = normalizeDate(req.body.date);
    if (!date) {
      return res.status(400).json({
        status: "Error",
        message: "Format tanggal tidak valid (gunakan YYYY-MM-DD).",
      });
    }
  }

  if (accountId !== null) {
    if (!Number.isInteger(accountId) || !(await findOwnedId("accounts", accountId, req.userId))) {
      return res.status(400).json({
        status: "Error",
        message: "Rekening tidak ditemukan.",
      });
    }
  }

  if (categoryId !== null) {
    if (!Number.isInteger(categoryId) || !(await findOwnedId("categories", categoryId, req.userId))) {
      return res.status(400).json({
        status: "Error",
        message: "Kategori tidak ditemukan.",
      });
    }
  }

  const signedAmount = report === "Expenses" ? -Math.abs(amount) : Math.abs(amount);

  const result = await pool.query(
    `INSERT INTO transactions
       (user_id, account_id, category_id, title, amount, report, date, note)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8)
     RETURNING id`,
    [
      req.userId,
      accountId,
      categoryId,
      title,
      signedAmount,
      report,
      date,
      note,
    ]
  );

  const transaction = await getTransaction(result.rows[0].id, req.userId);
  return res.status(201).json({ status: "Success", data: transaction });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: "Error",
      message: "ID transaksi tidak valid.",
    });
  }

  const currentResult = await pool.query(
    `SELECT id, title, amount, report, note, account_id, category_id,
            to_char(date, 'YYYY-MM-DD') AS date_iso
     FROM transactions
     WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );

  if (currentResult.rowCount === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Transaksi tidak ditemukan.",
    });
  }

  const current = currentResult.rows[0];
  const patch = req.body || {};

  const title =
    patch.title === undefined
      ? current.title
      : String(patch.title).trim() || "Tanpa Keterangan";

  if (title.length > 120) {
    return res.status(400).json({
      status: "Error",
      message: "Keterangan maksimal 120 karakter.",
    });
  }

  const report =
    patch.report === undefined
      ? current.report
      : normalizeReport(patch.report, current.report);

  let absoluteAmount = Math.abs(current.amount);
  if (patch.amount !== undefined) {
    absoluteAmount = Math.trunc(parseAmount(patch.amount));
    if (!Number.isFinite(absoluteAmount) || absoluteAmount <= 0) {
      return res.status(400).json({
        status: "Error",
        message: "Nominal harus berupa angka lebih dari 0.",
      });
    }
  }

  let date = current.date_iso;
  if (patch.date !== undefined) {
    date = normalizeDate(patch.date);
    if (!date) {
      return res.status(400).json({
        status: "Error",
        message: "Format tanggal tidak valid (gunakan YYYY-MM-DD).",
      });
    }
  }

  let accountId = current.account_id;
  if (patch.accountId !== undefined) {
    accountId = patch.accountId === null ? null : Number(patch.accountId);
    if (
      accountId !== null &&
      (!Number.isInteger(accountId) ||
        !(await findOwnedId("accounts", accountId, req.userId)))
    ) {
      return res.status(400).json({
        status: "Error",
        message: "Rekening tidak ditemukan.",
      });
    }
  }

  let categoryId = current.category_id;
  if (patch.categoryId !== undefined) {
    categoryId = patch.categoryId === null ? null : Number(patch.categoryId);
    if (
      categoryId !== null &&
      (!Number.isInteger(categoryId) ||
        !(await findOwnedId("categories", categoryId, req.userId)))
    ) {
      return res.status(400).json({
        status: "Error",
        message: "Kategori tidak ditemukan.",
      });
    }
  }

  let note = current.note;
  if (patch.note !== undefined) {
    note = patch.note === null ? null : String(patch.note).trim().slice(0, 500);
  }

  const signedAmount =
    report === "Expenses" ? -Math.abs(absoluteAmount) : Math.abs(absoluteAmount);

  await pool.query(
    `UPDATE transactions
     SET title = $1,
         amount = $2,
         report = $3,
         date = $4,
         account_id = $5,
         category_id = $6,
         note = $7,
         updated_at = now()
     WHERE id = $8 AND user_id = $9`,
    [
      title,
      signedAmount,
      report,
      date,
      accountId,
      categoryId,
      note,
      id,
      req.userId,
    ]
  );

  const transaction = await getTransaction(id, req.userId);
  return res.json({ status: "Success", data: transaction });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: "Error",
      message: "ID transaksi tidak valid.",
    });
  }

  const result = await pool.query(
    "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Transaksi tidak ditemukan.",
    });
  }

  return res.json({ status: "Success" });
});

export default router;
