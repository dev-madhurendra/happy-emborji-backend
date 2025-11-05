import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  price: number;
  category: string;
  tag: string;
  image: string;
  images: string[];
}

const ProductSchema = new Schema<IProduct>({
  name: String,
  price: Number,
  category: String,
  tag: String,
  image: String,
  images: [String],
});

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
