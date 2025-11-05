import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/admin";

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.post("/admin/signup", async (req, reply) => {
    try {
      const { username, password } = req.body as { username: string; password: string };
      if (!username || !password)
        return reply.status(400).send({ error: "Username and password are required" });

      const existingAdmin = await Admin.findOne();
      if (existingAdmin)
        return reply
          .status(403)
          .send({ error: "Admin account already exists. Signup disabled." });

      const hashed = await bcrypt.hash(password, 10);
      const admin = await Admin.create({ username, password: hashed });

      return reply.status(201).send({ message: "Admin created successfully", id: admin._id });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post("/admin/login", async (req, reply) => {
    try {
      const { username, password } = req.body as { username: string; password: string };

      const admin = await Admin.findOne({ username });
      if (!admin) return reply.status(400).send({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return reply.status(400).send({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: admin._id, username: admin.username },
        process.env.JWT_SECRET as string,
        { expiresIn: "1d" }
      );

      return reply.send({ message: "Login successful", token });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
