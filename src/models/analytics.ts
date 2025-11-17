import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  date: { type: Date, default: () => new Date() },
  event: { type: String, required: true },
  ip: { type: String },
  ua: { type: String },
});

export const Analytics = mongoose.model("Analytics", analyticsSchema);
