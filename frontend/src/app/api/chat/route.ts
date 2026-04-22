import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
    try {
        const { message, sessionId } = await req.json();
        const res = await fetch("https://backend-service-979222274214.asia-south1.run.app/chat",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, sessionId }),
            }
        );

        if (!res.ok) {
            throw new Error(`Backend returned ${res.status}`);
        }

        return new Response(res.body, {
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (e) {
        return new Response(

            JSON.stringify({ error: `Failed to fetch chat reply. ${e}` }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
