import { FastifyInstance, FastifyPluginAsync } from "fastify";
import NodeCache from "node-cache";
import cloudinary from "../utils/cloudinary";
import { verifyAdmin } from "../middleware/auth";
import { SeasonPoster } from "../models/seasonPoster";

const cache = new NodeCache({ stdTTL: 300 });

// Reusable cloudinary uploader — same as productRoutes
const uploadToCloudinary = (fileBuffer: Buffer): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "season-posters" },
      (err, result) => {
        if (err || !result) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });

const seasonPosterRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  /** GET /season-posters/active — main page banners, cached */
  fastify.get("/season-posters/active", async (req, reply) => {
    try {
      const cached = cache.get("active_posters");
      if (cached) return reply.send(cached);

      const now = new Date();
      const posters = await SeasonPoster.find({
        isActive: true,
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        ],
      }).sort({ displayOrder: 1, createdAt: -1 });

      cache.set("active_posters", posters);
      reply.send(posters);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────
  // ADMIN — CRUD
  // ─────────────────────────────────────────────

  /** GET /season-posters — all posters, optional ?isActive= + pagination */
  fastify.get("/season-posters", async (req, reply) => {
    try {
      const { isActive, page = "1", limit = "10" } = req.query as {
        isActive?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(50, parseInt(limit)));

      const filter: Record<string, unknown> = {};
      if (isActive !== undefined) filter.isActive = isActive === "true";

      const total = await SeasonPoster.countDocuments(filter);
      const posters = await SeasonPoster.find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      reply.send({ page: pageNum, totalPages: Math.ceil(total / limitNum), total, posters });
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  /** GET /season-posters/:id */
  fastify.get("/season-posters/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const poster = await SeasonPoster.findById(id);
      if (!poster) return reply.code(404).send({ error: "Poster not found" });
      reply.send(poster);
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  /**
   * POST /season-posters — multipart form-data
   */
  fastify.post(
    "/season-posters",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const parts = (req as any).parts?.();
        if (!parts) return reply.code(400).send({ error: "Expected multipart form-data" });

        const fields: Record<string, any> = {};
        let imageBuffer: Buffer | null = null;

        for await (const part of parts) {
          if (part.file) {
            // CRITICAL BUG FIX: Only keep the buffer if it matches your key, 
            // otherwise consume it anyway to drain the network stream and prevent hangs.
            if (part.fieldname === "image" && part.filename) {
              imageBuffer = await part.toBuffer();
            } else {
              await part.toBuffer(); 
            }
          } else {
            fields[part.fieldname] = part.value;
          }
        }

        if (!fields.title || !fields.description) {
          return reply.code(400).send({ error: "title and description are required" });
        }
        if (!imageBuffer) {
          return reply.code(400).send({ error: "image file is required" });
        }

        // Upload banner image to Cloudinary
        const imageUrl = await uploadToCloudinary(imageBuffer);

        // Safe JSON parsing protection
        let salePoints = [];
        if (fields.salePoints) {
          try {
            salePoints = JSON.parse(fields.salePoints);
          } catch {
            return reply.code(400).send({ error: "salePoints must be a valid JSON string array" });
          }
        }

        const poster = new SeasonPoster({
          title: fields.title,
          description: fields.description,
          image: imageUrl,
          salePoints,
          isActive: fields.isActive === "true",
          badgeText: fields.badgeText,
          ctaLabel: fields.ctaLabel,
          ctaLink: fields.ctaLink,
          bgColor: fields.bgColor,
          startDate: fields.startDate ? new Date(fields.startDate) : null,
          endDate: fields.endDate ? new Date(fields.endDate) : null,
          displayOrder: fields.displayOrder ? Number(fields.displayOrder) : 0,
        });

        await poster.save();
        cache.del("active_posters");

        reply.code(201).send({ message: "Season poster created", poster });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  /**
   * PUT /season-posters/:id — multipart form-data
   */
  fastify.put(
    "/season-posters/:id",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };

        const parts = (req as any).parts?.();
        if (!parts) return reply.code(400).send({ error: "Expected multipart form-data" });

        const fields: Record<string, any> = {};
        let imageBuffer: Buffer | null = null;

        for await (const part of parts) {
          if (part.file) {
            if (part.fieldname === "image" && part.filename) {
              imageBuffer = await part.toBuffer();
            } else {
              await part.toBuffer(); // Always drain unhandled streams
            }
          } else {
            fields[part.fieldname] = part.value;
          }
        }

        // Upload new image only if a fresh one was explicitly provided
        if (imageBuffer) {
          fields.image = await uploadToCloudinary(imageBuffer);
        }

        if (fields.salePoints) {
          try {
            fields.salePoints = JSON.parse(fields.salePoints);
          } catch {
            return reply.code(400).send({ error: "salePoints must be a valid JSON string array" });
          }
        }
        
        if (fields.isActive !== undefined) {
          fields.isActive = fields.isActive === "true";
        }
        if (fields.displayOrder !== undefined) {
          fields.displayOrder = Number(fields.displayOrder);
        }
        if (fields.startDate) fields.startDate = new Date(fields.startDate);
        if (fields.endDate) fields.endDate = new Date(fields.endDate);

        const poster = await SeasonPoster.findByIdAndUpdate(
          id,
          { $set: fields },
          { new: true, runValidators: true }
        );

        if (!poster) return reply.code(404).send({ error: "Poster not found" });

        cache.del("active_posters");
        reply.send({ message: "Season poster updated", poster });
      } catch (err: any) {
        fastify.log.error(err);
        reply.code(500).send({ error: err.message });
      }
    }
  );

  /** PATCH /season-posters/:id/toggle — flip isActive */
  fastify.patch(
    "/season-posters/:id/toggle",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const poster = await SeasonPoster.findById(id);
        if (!poster) return reply.code(404).send({ error: "Poster not found" });

        poster.isActive = !poster.isActive;
        await poster.save();

        cache.del("active_posters");
        reply.send({
          message: `Poster is now ${poster.isActive ? "active" : "inactive"}`,
          poster,
        });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  /** PATCH /season-posters/:id/sale-points — replace sale points array */
  fastify.patch(
    "/season-posters/:id/sale-points",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const { salePoints } = req.body as {
          salePoints: { icon?: string; text: string }[];
        };

        if (!Array.isArray(salePoints)) {
          return reply.code(400).send({ error: "salePoints must be an array" });
        }

        const poster = await SeasonPoster.findByIdAndUpdate(
          id,
          { $set: { salePoints } },
          { new: true, runValidators: true }
        );

        if (!poster) return reply.code(404).send({ error: "Poster not found" });

        cache.del("active_posters");
        reply.send(poster);
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  /** PATCH /season-posters/reorder — bulk displayOrder update */
  fastify.patch(
    "/season-posters/reorder",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { order } = req.body as {
          order: { id: string; displayOrder: number }[];
        };

        if (!Array.isArray(order)) {
          return reply.code(400).send({ error: "order must be an array" });
        }

        await Promise.all(
          order.map(({ id, displayOrder }) =>
            SeasonPoster.findByIdAndUpdate(id, { displayOrder })
          )
        );

        cache.del("active_posters");
        reply.send({ message: "Display order updated" });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );

  /** DELETE /season-posters/:id */
  fastify.delete(
    "/season-posters/:id",
    { preHandler: verifyAdmin },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string };
        const poster = await SeasonPoster.findByIdAndDelete(id);
        if (!poster) return reply.code(404).send({ error: "Poster not found" });

        cache.del("active_posters");
        reply.send({ message: "Poster deleted successfully" });
      } catch (err: any) {
        reply.code(500).send({ error: err.message });
      }
    }
  );
};

export default seasonPosterRoutes;