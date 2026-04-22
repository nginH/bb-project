
import { openai, index } from "../lib/ai";

export async function vectorSearch(query: string) {

    console.log("called vector search");
    const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const embedding = embeddingRes.data[0].embedding;

    const search = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
    });

    const context = search.matches
        ?.map((m) => m.metadata?.text)
        .join("\n");

    return {
        context: context || "",
        matchCount: search.matches?.length || 0,
        message: context ? "Found relevant information." : "No relevant information found in the vector database."
    };
}

export const vectorDbTool = {
    type: "function",
    function: {
        name: "vector_db_search",
        description: "Search the local vector database for information specifically related to Assam University admissions, courses, and department details. This should be the first tool used for university-specific queries.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query to look up in the vector database.",
                },
            },
            required: ["query"],
        },
    },
};
