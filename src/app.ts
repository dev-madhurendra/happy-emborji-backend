import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import connectDB from "./db";
import productRoutes from "./routes/product";
import categoryRoutes from "./routes/categories";
import adminRoutes from "./routes/admin";
import tagRoutes from "./routes/tag";
import reviewRoutes from "./routes/review";
import analyticsRoutes from "./routes/analytics";

dotenv.config();

const start = async () => {
  const fastify = Fastify({ logger: true });

  await connectDB();

  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? ["https://www.happyembroji.store"]
      : ["*"];

  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  });

  await fastify.register(multipart);

  fastify.register(productRoutes, { prefix: "/api" });
  fastify.register(categoryRoutes, { prefix: "/api" });
  fastify.register(adminRoutes, { prefix: "/api" });
  fastify.register(tagRoutes, { prefix: "/api" });
  fastify.register(reviewRoutes, { prefix: "/api" });
  fastify.register(analyticsRoutes, { prefix: "/api" });

  fastify.get("/", async () => ({ status: "Backend running 🚀" }));

  try {
    await fastify.listen({
      port: Number(process.env.PORT) || 8081,
      host: "0.0.0.0",
    });
    console.log("✅ Server started");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
