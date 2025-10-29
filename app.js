import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import connectDB from "./db.js";
import dotenv from "dotenv";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

// MongoDB setup
connectDB();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Multer setup for file upload
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

// Upload endpoint
app.post("/api/addProduct", upload.fields([
  { name: "image", maxCount: 1 },     // main image
  { name: "images", maxCount: 5 }     // up to 5 additional images
]), async (req, res) => {
  try {
    const uploadToCloudinary = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "happy-embroji" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(fileBuffer);
      });
    };

    // Upload the main image
    const mainImage = req.files?.image?.[0];
    const mainImageUrl = mainImage
      ? await uploadToCloudinary(mainImage.buffer)
      : null;

    // Upload additional images (if any)
    const additionalImages = req.files?.images || [];
    const additionalImageUrls = await Promise.all(
      additionalImages.map((img) => uploadToCloudinary(img.buffer))
    );

    // Save to MongoDB
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      tags: req.body.tags.split(",").map((tag) => tag.trim()),
      image: mainImageUrl,
      images: additionalImageUrls,
    });

    await product.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 }); // newest first
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all unique categories with one sample image each
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          sampleImage: { $first: "$image" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Optional: rename _id -> category for cleaner response
    const formatted = categories.map(cat => ({
      category: cat._id,
      image: cat.sampleImage,
      count: cat.count
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(8081, () => console.log("API running on port 8081"));
