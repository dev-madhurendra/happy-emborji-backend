import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import connectDB from "./db.js";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB setup
connectDB();

// Cache instance
const cache = new NodeCache({ stdTTL: 600 }); // cache for 10 min (optional)

// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Schema
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  tags: [String],
  image: String,
  images: [String],
});
const Product = mongoose.model("Product", ProductSchema);

/* ============================================================
   🔥 Utility: Rebuild and cache categories
============================================================ */
async function refreshCategoriesCache() {
  const categories = await Product.aggregate([
    {
      $group: {
        _id: "$category",
        sampleImage: { $first: "$image" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const formatted = categories.map((cat) => ({
    category: cat._id,
    image: cat.sampleImage,
    count: cat.count,
  }));

  cache.set("categories", formatted);
  console.log("♻️ Categories cache refreshed");
  return formatted;
}

/* ============================================================
   📦 Add Product
============================================================ */
app.post(
  "/api/addProduct",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const uploadToCloudinary = (fileBuffer) =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "happy-embroji" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );
          uploadStream.end(fileBuffer);
        });

      // Upload main + additional images
      const mainImage = req.files?.image?.[0];
      const mainImageUrl = mainImage
        ? await uploadToCloudinary(mainImage.buffer)
        : null;

      const additionalImages = req.files?.images || [];
      const additionalImageUrls = await Promise.all(
        additionalImages.map((img) => uploadToCloudinary(img.buffer))
      );

      const product = new Product({
        name: req.body.name,
        price: req.body.price,
        category: req.body.category,
        tags: req.body.tags.split(",").map((tag) => tag.trim()),
        image: mainImageUrl,
        images: additionalImageUrls,
      });

      await product.save();

      // Invalidate cache after product change
      cache.del("categories");
      console.log("🧹 Cache invalidated after new product");

      res.status(201).json({ message: "Product added successfully", product });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ============================================================
   🗑️ Delete Product
============================================================ */
app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });

    cache.del("categories");
    console.log("🧹 Cache invalidated after deletion");

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   🧾 Get All Products
============================================================ */
app.get("/api/products", async (req, res) => {
  try {
    // Parse query params with default values
    const page = parseInt(req.query.page) || 1;       // Default page = 1
    const limit = parseInt(req.query.limit) || 10;    // Default limit = 10

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Fetch paginated data
    const products = await Product.find()
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);

    // Count total documents
    const total = await Product.countDocuments();

    // Return paginated response
    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ============================================================
   🗂️ Get Categories (cached)
============================================================ */
app.get("/api/categories", async (req, res) => {
  try {
    const cached = cache.get("categories");
    if (cached) {
      console.log("✅ Served categories from cache");
      return res.json(cached);
    }

    const fresh = await refreshCategoriesCache();
    res.json(fresh);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   🩺 Root Health Endpoint
============================================================ */
app.get("/", (req, res) => {
  res.send("Backend API is running 🚀");
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
