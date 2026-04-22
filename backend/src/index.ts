import Fastify from "fastify";
import { chatRoutes } from "./routes/chat.route";

const app = Fastify();

app.register(chatRoutes);


app.get("/health", async () => {
    return { status: "ok" };
});

const port = Number(process.env.PORT) || 8080;

app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server running on port ${port}`);
});