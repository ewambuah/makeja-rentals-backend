import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
db.query("SELECT NOW()")
  .then(res => {
    console.log("✅ PostgreSQL connected:", res.rows[0]);
  })
  .catch(err => {
    console.error("❌ PostgreSQL connection failed:", err);
  });