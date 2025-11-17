import { FastifyInstance } from "fastify";
import { Analytics } from "../models/analytics";

export default async function analyticsRoutes(fastify: FastifyInstance) {

  fastify.post("/track", async (req, reply) => {
    try {
      const body: any = req.body;
      const event = body?.event;

      if (!event) {
        return reply.code(400).send({ ok: false, error: "Missing event" });
      }

      const ua = req.headers["user-agent"] || "";
      const lowerUA = ua.toLowerCase();
      const isBot =
        lowerUA.includes("bot") ||
        lowerUA.includes("crawl") ||
        lowerUA.includes("spider");

      if (isBot) {
        return reply.send({ ok: true, bot: true });
      }

      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
        req.ip;

      await Analytics.create({ event, ip, ua });

      return reply.send({ ok: true });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: "Server error" });
    }
  });

  fastify.get("/stats", async (_req, reply) => {
    try {
      const totalVisits = await Analytics.countDocuments({ event: "visit" });

      const uniqueIPs = await Analytics.distinct("ip", { event: "visit" });

      return reply.send({
        totalVisits,
        uniqueUsers: uniqueIPs.length,
      });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: "Server error" });
    }
  });
}
