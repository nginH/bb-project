import Fastify from "fastify";
import { chatRoutes } from "./routes/chat.route";

const app = Fastify();

app.register(chatRoutes);

app.listen({ port: 8080 }, () => {
    console.log("Server running on port 8080");
});