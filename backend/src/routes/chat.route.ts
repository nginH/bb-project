import { FastifyInstance } from "fastify";
import { askAI } from "../services/chat.service";

export async function chatRoutes(app: FastifyInstance) {
    app.post("/chat", async (req, reply) => {
        const { message, sessionId } = req.body as { message: string, sessionId?: string };

        if (!message) {
            return reply.status(400).send({ error: "Message required" });
        }

        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");

        const stream = await askAI(message, sessionId);

        for await (const chunk of (stream as any)) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                reply.raw.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
    });
}