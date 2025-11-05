import { FastifyPluginAsync } from "fastify";
import { Product } from "../models/product";

const tagRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/tags", async (req, reply) => {
    try {
      const tags = await Product.distinct("tag");
      return reply.status(200).send({ tags });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
};

export default tagRoutes;