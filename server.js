import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mysql from "mysql2";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ================== MIDDLEWARE ==================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================== MYSQL CONNECTION ==================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "EmmanueL4013", // put your mysql password if you have one
  database: "makeja_rentals"
});

db.connect(err => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
    return;
  }
  console.log("✅ MySQL connected successfully");
});

// ================== MULTER CONFIG ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// ================== ROUTES ==================

// Test route
app.get("/", (req, res) => {
  res.send("Makeja Rentals API is running");
});

// GET ALL HOUSES
app.get("/api/houses", (req, res) => {
  db.query("SELECT * FROM houses", (err, results) => {
    if (err) return res.status(500).json({ error: err });

    if (results.length === 0) return res.json([]);

    let completed = 0;
    const houses = [];

    results.forEach(house => {
      db.query(
        "SELECT * FROM house_images WHERE house_id = ?",
        [house.id],
        (err2, images) => {
          if (err2) return res.status(500).json({ error: err2 });

          house.images = images;
          houses.push(house);
          completed++;

          if (completed === results.length) {
            res.json(houses);
          }
        }
      );
    });
  });
});

// ADD HOUSE
app.post("/api/houses", upload.array("images", 10), (req, res) => {
  console.log("🔥 ADD HOUSE REQUEST RECEIVED");

  const { title, location, price, size, phone, lat, lng } = req.body;

  if (!title || !location || !price || !size || !phone) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO houses (title, location, price, size, phone, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [title, location, price, size, phone, lat, lng], (err, result) => {
    if (err) {
      console.error("❌ Insert house error:", err);
      return res.status(500).json({ error: err });
    }

    const houseId = result.insertId;

    if (!req.files || req.files.length === 0) {
      return res.json({ success: true });
    }

    const imageValues = req.files.map(file => [
      houseId,
      "/uploads/" + file.filename
    ]);

    db.query(
      "INSERT INTO house_images (house_id, image_path) VALUES ?",
      [imageValues],
      err2 => {
        if (err2) {
          console.error("❌ Insert image error:", err2);
          return res.status(500).json({ error: err2 });
        }

        res.json({ success: true });
      }
    );
  });
});

// DELETE HOUSE
app.delete("/api/houses/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM house_images WHERE house_id = ?", [id], () => {
    db.query("DELETE FROM houses WHERE id = ?", [id], err => {
      if (err) return res.status(500).json({ error: err });
      res.json({ success: true });
    });
  });
});

// ================== START SERVER ==================
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});