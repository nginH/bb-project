
import { openai } from "../lib/ai";
import { webSearch, webSearchTool } from "../mcp/websearch";
import { vectorSearch, vectorDbTool } from "../mcp/vectordb";
import { pgAdmissionSearch, pgAdmissionTool } from "../mcp/pgSearch";

const sessions = new Map<string, any[]>();

export async function askAI(query: string, sessionId: string = "default") {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, [
            {
                role: "system",
                content: `You are an expert assistant for Assam University.
                1. Always check the vector database first using 'vector_db_search'.
                2. If the results from 'vector_db_search' are missing, incomplete, or insufficient for a full answer, you MUST use 'web_search' to find the remaining details.
                3. Be professional and direct. No repetitive greetings.
                4. If the user is asking about admission, use 'pg_admission_search' to find the candidate's details.
                5. Only answer university-related queries.`,
            }
        ]);
    }

    const history = sessions.get(sessionId)!;
    history.push({ role: "user", content: query });

    const tools: any[] = [webSearchTool, vectorDbTool, pgAdmissionTool];

    let response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: history.slice(-15) as any,
        tools,
        tool_choice: "auto",
    });

    let message = response.choices[0].message;
    let turns = 0;

    // Loop to handle sequential tool calls (e.g. Vector DB -> Web Search)
    while (message.tool_calls && turns < 3) {
        history.push(message);

        const toolPromises = (message.tool_calls as any[]).map(async (toolCall) => {
            if (toolCall.type !== "function") return null;

            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            let result;

            if (functionName === "vector_db_search") {
                result = await vectorSearch(args.query);
            } else if (functionName === "web_search") {
                result = await webSearch(args.query);
            } else if (functionName === "pg_admission_search") {
                result = await pgAdmissionSearch(args.query, {
                    category: args.category,
                    listType: args.listType,
                    minScore: args.minScore
                });
            }

            return {
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            };
        });

        const toolResponses = await Promise.all(toolPromises);
        for (const tr of toolResponses) {
            if (tr) history.push(tr as any);
        }

        // Call again to see if more tools are needed or if we can answer
        response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: history.slice(-20) as any,
            tools,
            tool_choice: "auto",
        });

        message = response.choices[0].message;
        turns++;
    }

    // Final response streaming the answer
    return openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: history.slice(-20) as any,
        stream: true,
    });
}