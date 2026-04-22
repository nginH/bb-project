import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

import dotenv from "dotenv";
dotenv.config();

const INPUT_JSON = path.join(__dirname, "output_raw.json");
const OUTPUT_JSON = path.join(__dirname, "output_structured.json");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" }
});


const SCHEMA_PROMPT = `
Extract structured candidate data from OCR text of a university merit list.

Return JSON:
{
  "data": [...],
  "types": {
    "field": "string | number"
  }
}

Rules:
- Normalize field names (camelCase)
- Include useful fields like applicationNo, name, category, gender, score, rank, listType
- Combine all lists (selected, waiting, etc.)
- Keep schema minimal but complete

ONLY return JSON.
`;

function buildStrictPrompt(schema: any) {
    return `
Extract candidates using EXACT schema below:

SCHEMA:
${JSON.stringify(schema, null, 2)}

Rules:
- DO NOT add fields
- DO NOT remove fields
- Missing values → null
- Keep types consistent

Return JSON:
{
  "data": [...]
}

ONLY JSON.
`;
}

async function callGemini(prompt: string) {
    for (let i = 0; i < 2; i++) {
        try {
            const result = await model.generateContent(prompt);
            let text = result.response.text();

            // remove ```json ``` wrappers if present
            text = text.replace(/```json|```/g, "").trim();

            return JSON.parse(text);
        } catch (err) {
            console.warn(`Retry Gemini (Attempt ${i + 1})... Error:`, (err as Error).message);
        }
    }
    return null;
}

async function mapWithLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    const executing = new Set<Promise<void>>();

    for (const item of items) {
        const p = fn(item).then(res => {
            results.push(res);
            executing.delete(p);
        });
        executing.add(p);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}


async function main() {
    const input = JSON.parse(fs.readFileSync(INPUT_JSON, "utf-8"));
    const meritList = (input.meritList as any[]).slice(0, 110); // Limit to top 10 for safety/demo, adjust as needed

    let lockedSchema: any = null;
    const finalResults: any[] = [];

    const firstItem = meritList.find(i => i.rawText);
    if (firstItem) {
        console.log("INITIAL PROCESSING (LOCKED SCHEMA):", firstItem.title);
        try {
            const res = await callGemini(
                SCHEMA_PROMPT + "\n\nTEXT:\n" + firstItem.rawText.slice(0, 15000)
            );
            if (res) {
                lockedSchema = res.types;
                console.log("SCHEMA LOCKED:", lockedSchema);
                finalResults.push({
                    title: firstItem.title,
                    url: firstItem.url,
                    data: res.data || [],
                });
            }
        } catch (err) {
            console.error("FAILED TO LOCK SCHEMA:", err);
        }
    }

    const remainingItems = meritList.filter(item => item !== firstItem);

    console.log(`Processing remaining ${remainingItems.length} items in parallel...`);

    const parallelResults = await mapWithLimit(
        remainingItems,
        5, // concurrency
        async (item) => {
            if (!item.rawText) {
                return {
                    title: item.title,
                    url: item.url,
                    data: [],
                    error: true,
                };
            }

            console.log("PROCESSING:", item.title);
            try {
                let structured;
                if (!lockedSchema) {
                    // This fallback shouldn't really happen if firstItem worked
                    structured = await callGemini(SCHEMA_PROMPT + "\n\nTEXT:\n" + item.rawText.slice(0, 15000));
                } else {
                    const prompt = buildStrictPrompt(lockedSchema) + "\n\nTEXT:\n" + item.rawText.slice(0, 15000);
                    structured = await callGemini(prompt);
                }

                return {
                    title: item.title,
                    url: item.url,
                    data: structured?.data || [],
                };
            } catch (err) {
                console.error("FAILED:", item.url);
                return {
                    title: item.title,
                    url: item.url,
                    data: [],
                    aiError: true,
                };
            }
        }
    );

    const allResults = [...finalResults, ...parallelResults];

    await fs.promises.writeFile(
        OUTPUT_JSON,
        JSON.stringify(
            {
                schema: lockedSchema,
                meritList: allResults,
            },
            null,
            2
        )
    );

    console.log("DONE →", OUTPUT_JSON);
}

main();