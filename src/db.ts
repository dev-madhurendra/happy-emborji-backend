import mongoose from "mongoose";

export default async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ MongoDB connected");
  } catch (err: any) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}
