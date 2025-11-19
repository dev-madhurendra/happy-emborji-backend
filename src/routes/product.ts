import { FastifyInstance, FastifyPluginAsync } from "fastify";
import NodeCache from "node-cache";
import cloudinary from "../utils/cloudinary";
import { Product } from "../models/product";
import { verifyAdmin } from "../middleware/auth";

const cache = new NodeCache({ stdTTL: 600 });

const productRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post(
    "/addProduct",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const parts = (req as any).parts?.();
        const fields: Record<string, any> = {};
        const buffers: { image: Buffer | null; images: Buffer[] } = {
          image: null,
          images: [],
        };

        for await (const part of parts) {
          if (part.file) {
            const buffer = await part.toBuffer();
            if (part.fieldname === "image") buffers.image = buffer;
            else if (part.fieldname === "images") buffers.images.push(buffer);
          } else {
            fields[part.fieldname] = part.value;
          }
        }

        const uploadToCloudinary = (fileBuffer: Buffer): Promise<string> =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "happy-embroji" },
              (err, result) => {
                if (err || !result) reject(err);
                else resolve(result.secure_url);
              }
            );
            stream.end(fileBuffer);
          });

        const mainImageUrl = buffers.image
          ? await uploadToCloudinary(buffers.image)
          : null;
        const additionalImageUrls = await Promise.all(
          buffers.images.map((b) => uploadToCloudinary(b))
        );

        const product = new Product({
          ...fields,
          image: mainImageUrl,
          images: additionalImageUrls,
        });

        await product.save();

        cache.del("categories");
        reply.code(201).send({ message: "Product added", product });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  fastify.get("/products", async (req, reply) => {
    try {
      const {
        tag,
        category,
        minPrice,
        maxPrice,
        page = "1",
        limit = "10",
      } = req.query as {
        tag?: string;
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const filters: any = {};

      if (category) filters.category = new RegExp(`^${category}$`, "i");
      if (tag) filters.tag = new RegExp(`^${tag}$`, "i");

      if (!isNaN(Number(minPrice)) && minPrice !== "")
        filters.price = { ...filters.price, $gte: Number(minPrice) };
      if (!isNaN(Number(maxPrice)) && maxPrice !== "")
        filters.price = { ...filters.price, $lte: Number(maxPrice) };

      console.log("Filters applied:", filters);

      const total = await Product.countDocuments(filters);
      const products = await Product.find(filters)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum);

      reply.send({
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
        filters,
        products,
      });
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/products/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };

      const product = await Product.findById(id);

      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }

      reply.send(product);
    } catch (err: any) {
      console.error("Error fetching product by ID:", err);
      reply.code(500).send({ error: err.message || "Server error" });
    }
  });

  fastify.put(
    "/products/:id",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const body = req.body as Partial<{
          name: string;
          price: number;
          category: string;
          tag: string;
          image: string;
          description: string;
          images: string[];
        }>;

        const updatedProduct = await Product.findByIdAndUpdate(id, body, {
          new: true,
          runValidators: true,
        });

        if (!updatedProduct) {
          return reply.status(404).send({ error: "Product not found" });
        }

        return reply.status(200).send({
          message: "Product updated successfully",
          product: updatedProduct,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  fastify.delete(
    "/products/:id",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const deleted = await Product.findByIdAndDelete(id);
        if (!deleted)
          return reply.code(404).send({ error: "Product not found" });

        cache.del("categories");
        reply.send({ message: "Product deleted" });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  fastify.get("/products/search", async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q) return reply.send([]);

    const products = await Product.find({
      name: { $regex: q, $options: "i" },
    }).select("_id name");

    reply.send(products);
  });
};

export default productRoutes;
