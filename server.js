// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { db } from "./db.js";
import cloudinary from "./cloudinary.js";
import streamifier from "streamifier";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({ origin: "*" }));

// Parse JSON & URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer memory storage for Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Health check
app.get("/", (req, res) => res.send("🚀 Makeja Rentals API is running"));

// ---------------- ADD HOUSE ----------------
app.post("/api/houses", upload.array("images", 10), async (req, res) => {
  try {
    let { title, location, price, size, phone, lat, lng } = req.body;

    if (!title || !location || !price || !size || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    lat = lat ? parseFloat(lat) : null;
    lng = lng ? parseFloat(lng) : null;

    // Insert house
    const insertHouseQuery = `
      INSERT INTO houses (title, location, price, size, phone, lat, lng)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const result = await db.query(insertHouseQuery, [title, location, price, size, phone, lat, lng]);
    const houseId = result.rows[0].id;

    // Upload images to Cloudinary and save URLs
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "makeja_houses" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });

        await db.query(
          "INSERT INTO house_images (house_id, image_path) VALUES ($1, $2)",
          [houseId, uploadResult.secure_url]
        );
      }
    }

    res.json({ success: true, houseId });

  } catch (err) {
    console.error("❌ Add house error:", err);
    res.status(500).json({ error: err.message, detail: err.detail, code: err.code });
  }
});

// ---------------- GET HOUSES ----------------
app.get("/api/houses", async (req, res) => {
  try {
    const housesResult = await db.query("SELECT * FROM houses ORDER BY created_at DESC");
    const imagesResult = await db.query("SELECT * FROM house_images");

    const houses = housesResult.rows.map(h => ({
      ...h,
      images: imagesResult.rows.filter(img => img.house_id === h.id)
    }));

    res.json(houses);

  } catch (err) {
    console.error("❌ Get houses error:", err);
    res.status(500).json({ error: err.message, detail: err.detail, code: err.code });
  }
});

// ---------------- DELETE HOUSE ----------------
app.delete("/api/houses/:id", async (req, res) => {
  try {
    const houseId = req.params.id;

    // Delete image URLs from DB only (Cloudinary can keep copies if you want)
    await db.query("DELETE FROM house_images WHERE house_id = $1", [houseId]);
    await db.query("DELETE FROM houses WHERE id = $1", [houseId]);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Delete house error:", err);
    res.status(500).json({ error: err.message, detail: err.detail, code: err.code });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));