import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  type: "chat" | "text"; 
  platform?: "whatsapp" | "instagram"; 
  authorName?: string; 
  rating?: number; 
  message: string; 
  imageUrl?: string; 
  createdAt: Date;
  productId?: mongoose.Types.ObjectId;
}

const ReviewSchema = new Schema<IReview>(
  {
    type: {
      type: String,
      enum: ["chat", "text"],
      required: true,
    },
    platform: {
      type: String,
      enum: ["whatsapp", "instagram"],
    },
    authorName: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
  },
  { timestamps: true }
);


export const Review = mongoose.model<IReview>("Product", ReviewSchema);
