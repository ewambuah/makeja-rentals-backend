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
app.post("/api/houses", upload.array("images", 10), async (req, res) => {
  try {
    let { title, location, price, size, phone, lat, lng } = req.body;

    if (!title || !location || !price || !size || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    lat = parseFloat(lat) || null;
    lng = parseFloat(lng) || null;

    // Insert house into PostgreSQL
    const insertHouseQuery = `
      INSERT INTO houses (title, location, price, size, phone, lat, lng)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const result = await db.query(insertHouseQuery, [title, location, price, size, phone, lat, lng]);
    const houseId = result.rows[0].id;

    // If images uploaded, insert them
    if (req.files && req.files.length > 0) {
      const imageValues = req.files.map(file => [houseId, `/uploads/${file.filename}`]);
      const placeholders = imageValues.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
      const flatValues = imageValues.flat();

      const insertImagesQuery = `INSERT INTO house_images (house_id, image_path) VALUES ${placeholders}`;
      await db.query(insertImagesQuery, flatValues);
    }

    res.json({ success: true });
  } catch (err) {
  console.error("❌ Get houses error:", err);
  res.status(500).json({
    error: err.message,
    detail: err.detail,
    code: err.code
  });
}
});

// Get houses
app.get("/api/houses", async (req, res) => {
  try {
    const housesResult = await db.query("SELECT * FROM houses ORDER BY created_at DESC");
    const imagesResult = await db.query("SELECT * FROM house_images");

    const houses = housesResult.rows;
    const images = imagesResult.rows;

    houses.forEach(h => {
      h.images = images.filter(i => i.house_id === h.id);
    });

    res.json(houses);
  } catch (err) {
    console.error("❌ Get houses error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete house
app.delete("/api/houses/:id", async (req, res) => {
  try {
    const houseId = req.params.id;

    // Delete images first
    await db.query("DELETE FROM house_images WHERE house_id = $1", [houseId]);
    await db.query("DELETE FROM houses WHERE id = $1", [houseId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete house error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));