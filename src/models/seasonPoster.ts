import mongoose, { Schema, Document } from "mongoose";

export interface ISalePoint {
  icon?: string;   // emoji or icon URL
  text: string;    // e.g. "Free gift wrapping on all Rakhi orders"
}

export interface ISeasonPoster extends Document {
  title: string;
  description: string;
  image: string;              // primary banner image URL
  salePoints: ISalePoint[];   // bullet points admin adds (e.g. "Rakhi is here")
  isActive: boolean;          // controls visibility on main page
  badgeText?: string;         // e.g. "LIMITED OFFER", "RAKHI SPECIAL"
  ctaLabel?: string;          // call-to-action button label
  ctaLink?: string;           // call-to-action URL
  bgColor?: string;           // optional hex/css color for banner background
  startDate?: Date;           // auto-activate from this date
  endDate?: Date;             // auto-deactivate after this date
  displayOrder: number;       // for ordering multiple active posters
  createdAt: Date;
  updatedAt: Date;
}

const SalePointSchema = new Schema<ISalePoint>(
  {
    icon: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const SeasonPosterSchema = new Schema<ISeasonPoster>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    salePoints: { type: [SalePointSchema], default: [] },
    isActive: { type: Boolean, default: false },
    badgeText: { type: String, default: "" },
    ctaLabel: { type: String, default: "Shop Now" },
    ctaLink: { type: String, default: "" },
    bgColor: { type: String, default: "#ffffff" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Virtual: whether poster should currently be shown
// (active AND within date window if dates are set)
SeasonPosterSchema.virtual("isLive").get(function (this: ISeasonPoster) {
  if (!this.isActive) return false;
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  return true;
});

SeasonPosterSchema.set("toJSON", { virtuals: true });
SeasonPosterSchema.set("toObject", { virtuals: true });

export const SeasonPoster = mongoose.model<ISeasonPoster>(
  "SeasonPoster",
  SeasonPosterSchema
);