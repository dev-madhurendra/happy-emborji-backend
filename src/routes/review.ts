import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Review } from "../models/review";
import { verifyAdmin } from "../middleware/auth";
import cloudinary from "../utils/cloudinary";

const reviewRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post("/reviews", { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const parts = (req as any).parts?.();
      const fields: Record<string, any> = {};
      let imageBuffer: Buffer | null = null;

      // Collect all parts
      for await (const part of parts) {
        if (part.file) {
          if (part.fieldname === "image") {
            imageBuffer = await part.toBuffer();
          }
        } else {
          // Store the value directly
          fields[part.fieldname] = part.value;
        }
      }

      // Upload image if provided
      let imageUrl: string | undefined;
      if (imageBuffer) {
        imageUrl = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "happy-embroji/reviews" },
            (err, result) => {
              if (err || !result) reject(err);
              else resolve(result.secure_url);
            }
          );
          stream.end(imageBuffer);
        });
      }

      // Prepare review data with proper type conversion
      const reviewData: any = {
        type: fields.type,
        message: fields.message,
      };

      // Add optional fields if they exist
      if (fields.platform) reviewData.platform = fields.platform;
      if (fields.authorName) reviewData.authorName = fields.authorName;
      if (fields.rating) reviewData.rating = Number(fields.rating);
      if (fields.productId) reviewData.productId = fields.productId;
      if (imageUrl) reviewData.imageUrl = imageUrl;

      // Create and save review
      const review = new Review(reviewData);
      const saved = await review.save();

      reply.code(201).send(saved);
    } catch (err: any) {
      console.error("Error creating review:", err);
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/reviews", async (req, reply) => {
    try {
      const {
        productId,
        page = "1",
        limit = "10",
      } = req.query as {
        productId?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const filter = productId ? { productId } : {};

      const [reviews, totalReviews] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Review.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalReviews / limitNum);

      reply.send({
        reviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalReviews,
          totalPages,
          hasNextPage: pageNum < totalPages,
        },
      });
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/reviews/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const review = await Review.findById(id);
      if (!review) return reply.code(404).send({ message: "Review not found" });
      reply.send(review);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.put(
    "/reviews/:id",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        type ReviewUpdate = Partial<{
          type: "chat" | "text";
          platform: "whatsapp" | "instagram";
          authorName: string;
          rating: number;
          message: string;
          imageUrl: string;
          //   productId: mongoose.Types.ObjectId;
        }>;

        const body = req.body as ReviewUpdate;

        const updated = await Review.findByIdAndUpdate(id, body, {
          new: true,
          runValidators: true,
        });

        if (!updated) {
          return reply.code(404).send({ message: "Review not found" });
        }

        reply.send(updated);
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  fastify.delete("/reviews/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const deleted = await Review.findByIdAndDelete(id);
      if (!deleted)
        return reply.code(404).send({ message: "Review not found" });
      reply.send({ message: "Review deleted successfully" });
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
};

export default reviewRoutes;
