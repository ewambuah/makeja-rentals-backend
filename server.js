// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { db } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors({ origin: "*" }));

// Parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads folder
app.use("/uploads", express.static("uploads"));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Health check
app.get("/", (req, res) => res.send("Makeja Rentals API is running"));

// Add house
app.post("/api/houses", upload.array("images", 10), (req, res) => {
  let { title, location, price, size, phone, lat, lng } = req.body;

  if (!title || !location || !price || !size || !phone) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Convert lat/lng to numbers
  lat = parseFloat(lat) || null;
  lng = parseFloat(lng) || null;

  const sql = `INSERT INTO houses (title, location, price, size, phone, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [title, location, price, size, phone, lat, lng], (err, result) => {
    if (err) {
      console.error("❌ Insert house error:", err);
      return res.status(500).json({ error: err.message });
    }

    const houseId = result.insertId;

    if (!req.files || req.files.length === 0) return res.json({ success: true });

    const images = req.files.map(file => [houseId, `/uploads/${file.filename}`]);
    db.query("INSERT INTO house_images (house_id, image_path) VALUES ?", [images], (err2) => {
      if (err2) {
        console.error("❌ Insert images error:", err2);
        return res.status(500).json({ error: err2.message });
      }
      res.json({ success: true });
    });
  });
});

// Get houses
app.get("/api/houses", (req, res) => {
  db.query("SELECT * FROM houses ORDER BY created_at DESC", (err, houses) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query("SELECT * FROM house_images", (err2, images) => {
      if (err2) return res.status(500).json({ error: err2.message });

      houses.forEach(h => {
        h.images = images.filter(i => i.house_id === h.id);
      });

      res.json(houses);
    });
  });
});

// Delete house
app.delete("/api/houses/:id", (req, res) => {
  db.query("DELETE FROM houses WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));