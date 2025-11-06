import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Review } from "../models/review";
import { verifyAdmin } from "../middleware/auth";
import mongoose from "mongoose";

const reviewRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post("/reviews", { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const review = new Review(req.body);
      const saved = await review.save();
      reply.code(201).send(saved);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/reviews", async (req, reply) => {
    try {
      const { productId } = req.query as { productId?: string };
      const filter = productId ? { productId } : {};
      const reviews = await Review.find(filter).sort({ createdAt: -1 });
      reply.send(reviews);
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
          productId: mongoose.Types.ObjectId;
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
