import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export async function verifyAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) throw new Error("No token provided");

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (req as any).admin = decoded;
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}
