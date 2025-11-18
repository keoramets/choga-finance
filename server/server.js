import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { initDb } from "./db.js";

// 🔹 NEW: path + fileURLToPath so we can serve static files
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// 🔹 NEW: recreate __dirname in ES module world
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 NEW: path to your front-end files
const publicPath = path.join(__dirname, "public");

initDb();

app.use(cors());
app.use(express.json());

// 🔹 NEW: serve static files from /public
app.use(express.static(publicPath));

// ---------- AUTH HELPERS ----------
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ error: "Admin only" });
}

// ---------- AUTH ROUTES ----------

app.post("/auth/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const hashed = bcrypt.hashSync(password, 10);
  db.run(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
    [email, hashed, name || "", "user"],
    function (err) {
      if (err) {
        console.error(err);
        return res
          .status(400)
          .json({ error: "Could not create user (maybe email taken)" });
      }
      const user = { id: this.lastID, email, role: "user" };
      const token = generateToken(user);
      return res.json({ token, user });
    }
  );
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    });
  });
});

app.get("/auth/me", authMiddleware, (req, res) => {
  db.get(
    "SELECT id, email, name, role FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user });
    }
  );
});

// ---------- CRUD HELPERS ----------
function nowISO() {
  return new Date().toISOString();
}

// ---------- DEBTS API (example) ----------

// GET all debts for current user (admin can query all via ?userId=)
app.get("/api/debts", authMiddleware, (req, res) => {
  const userId =
    req.user.role === "admin" && req.query.userId
      ? Number(req.query.userId)
      : req.user.id;

  db.all("SELECT * FROM debts WHERE user_id = ?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: "Server error" });
    res.json(rows);
  });
});

// POST create debt
app.post("/api/debts", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { name, principal, interestRate, type, category, minPaymentMonthly } =
    req.body;
  const createdAt = nowISO();
  const updatedAt = createdAt;

  db.run(
    `INSERT INTO debts
     (user_id, name, principal, interest_rate, type, category, min_payment_monthly, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      name,
      principal || 0,
      interestRate || 0,
      type || "long_term",
      category || "other",
      minPaymentMonthly || 0,
      createdAt,
      updatedAt
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Server error" });
      db.get("SELECT * FROM debts WHERE id = ?", [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: "Server error" });
        res.status(201).json(row);
      });
    }
  );
});

// PUT update debt
app.put("/api/debts/:id", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const { name, principal, interestRate, type, category, minPaymentMonthly } =
    req.body;
  const updatedAt = nowISO();

  db.run(
    `UPDATE debts
     SET name = ?, principal = ?, interest_rate = ?, type = ?, category = ?, min_payment_monthly = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      name,
      principal || 0,
      interestRate || 0,
      type || "long_term",
      category || "other",
      minPaymentMonthly || 0,
      updatedAt,
      id,
      userId
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Server error" });
      if (this.changes === 0)
        return res.status(404).json({ error: "Debt not found" });
      db.get("SELECT * FROM debts WHERE id = ?", [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: "Server error" });
        res.json(row);
      });
    }
  );
});

// DELETE debt
app.delete("/api/debts/:id", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  db.run(
    "DELETE FROM debts WHERE id = ? AND user_id = ?",
    [id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: "Server error" });
      if (this.changes === 0)
        return res.status(404).json({ error: "Debt not found" });
      res.json({ success: true });
    }
  );
});

// Example admin route to list all users (admin only)
app.get("/api/users", authMiddleware, adminOnly, (req, res) => {
  db.all("SELECT id, email, name, role FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Server error" });
    res.json(rows);
  });
});

// 🔹 NEW: serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`NetWorth API + UI running on http://localhost:${PORT}`);
});
