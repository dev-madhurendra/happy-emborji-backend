import { FastifyPluginAsync } from "fastify";
import NodeCache from "node-cache";
import { Product } from "../models/product";

const cache = new NodeCache({ stdTTL: 600 });

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/categories", async (req, reply) => {
    try {
      const cached = cache.get("categories");

      if (cached) return reply.send(cached);

      const categories = await Product.aggregate([
        {
          $group: {
            _id: "$category",

            oldImage: { $first: "$image" },

            newFirstImage: { $first: { $arrayElemAt: ["$images", 0] } },

            allImages: { $push: "$images" },

            count: { $sum: 1 },
          },
        },

        {
          $project: {
            image: {
              $ifNull: ["$newFirstImage", "$oldImage"],
            },

            images: {
              $reduce: {
                input: "$allImages",
                initialValue: [],
                in: { $concatArrays: ["$$value", "$$this"] },
              },
            },

            count: 1,
          },
        },

        { $sort: { _id: 1 } },
      ]);

      const formatted = categories.map((c) => ({
        category: c._id,
        image: c.image, // best thumbnail
        images: c.images, // all category images
        count: c.count,
      }));

      cache.set("categories", formatted);
      reply.send(formatted);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/categories/:category/products", async (req, reply) => {
    const { category } = req.params as { category: string };
    const { page = "1", limit = "10" } = req.query as {
      page?: string;
      limit?: string;
    };
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit)));

    const totalProducts = await Product.countDocuments({
      category: new RegExp(`^${category}$`, "i"),
    });
    const totalPages = Math.ceil(totalProducts / limitNum);

    const products = await Product.find({
      category: new RegExp(`^${category}$`, "i"),
    })
      .sort({ _id: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    reply.send({
      category,
      page: pageNum,
      totalPages,
      totalProducts,
      products,
    });
  });
};

export default categoryRoutes;
