import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";

sqlite3.verbose();

const db = new sqlite3.Database("./networth.db");

export function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        current_balance REAL NOT NULL DEFAULT 0,
        interest_rate REAL NOT NULL DEFAULT 0,
        interest_compounding TEXT NOT NULL DEFAULT 'monthly',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        frequency TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        destination_type TEXT NOT NULL,
        destination_account_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (destination_account_id) REFERENCES accounts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        frequency TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        paid_from_type TEXT NOT NULL,
        paid_from_account_id INTEGER,
        category TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (paid_from_account_id) REFERENCES accounts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        principal REAL NOT NULL,
        interest_rate REAL NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        min_payment_monthly REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create default admin if not exists
    db.get(
      "SELECT id FROM users WHERE email = ?",
      ["admin@local"],
      async (err, row) => {
        if (err) {
          console.error("Error checking admin user:", err);
          return;
        }
        if (!row) {
          const hash = await bcrypt.hash("admin123", 10);
          db.run(
            "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
            ["admin@local", hash, "Admin", "admin"],
            (err2) => {
              if (err2) {
                console.error("Error creating admin user:", err2);
              } else {
                console.log('Default admin created: admin@local / "admin123" (change this!)');
              }
            }
          );
        }
      }
    );
  });
}

export default db;
