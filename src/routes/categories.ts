import { FastifyPluginAsync } from "fastify";
import NodeCache from "node-cache";
import { Product } from "../models/product";
import { verifyAdmin } from "../middleware/auth";

const cache = new NodeCache({ stdTTL: 600 });

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/categories", async (req, reply) => {
    try {
      const cached = cache.get("categories");
      if (cached) return reply.send(cached);

      const categories = await Product.aggregate([
        { $group: { _id: "$category", sampleImage: { $first: "$image" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const formatted = categories.map((c) => ({
        category: c._id,
        image: c.sampleImage,
        count: c.count,
      }));

      cache.set("categories", formatted);
      reply.send(formatted);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
};

export default categoryRoutes;
