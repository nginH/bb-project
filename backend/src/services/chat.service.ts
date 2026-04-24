
import { openai } from "../lib/ai";
import { webSearch, webSearchTool } from "../mcp/websearch";
import { vectorSearch, vectorDbTool } from "../mcp/vectordb";
import { pgAdmissionSearch, pgAdmissionTool } from "../mcp/pgSearch";

const sessions = new Map<string, any[]>();


const ambulenceList = [
    {
        "DriverName": "Rameshwar Singh",
        "ContactNumber": "9531041632",
        "driverName": "Rameshwar Singh",
        "startTime": "17:00",
        "endTime": "22:00"
    },
    {
        "DriverName": "Rameshwar Singh",
        "ContactNumber": "9531041632",
        "driverName": "Rameshwar Singh",
        "startTime": "06:00",
        "endTime": "10:00"
    },
    {
        "DriverName": "Health Center (24*7)",
        "ContactNumber": "03842281017",
        "startTime": "00:01",
        "endTime": "23:59"
    },
    {
        "DriverName": "Prasanta Narzary",
        "ContactNumber": "9435372335",
        "contactNumber": "9531041632",
        "driverName": "Rameshwar Singh",
        "startTime": "10:00",
        "endTime": "17:00"
    },
    {
        "DriverName": "Fayzul Haque",
        "ContactNumber": "9476699077",
        "driverName": "Fayzul Haque",
        "endTime": "08:00",
        "startTime": "20:00"
    },
    {
        "DriverName": "Babul Hussain",
        "ContactNumber": "9954721447",
        "startTime": "10:00",
        "endTime": "17:00"
    }
]

const doctorList = [
    {
        "name": "Dr. Satabhisha",
        "startTime": "00:00",
        "endTime": "23:59",
        "contact": "+91 70024 72633",
        "isAvailable": true
    },
    {
        "name": "Dr. Saurav Das",
        "startTime": "00:00",
        "endTime": "23:59",
        "contact": "+91 80119 30298",
        "isAvailable": true
    }
]

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
                6. Ambulance list: ${ambulenceList.map((ambulance) => `Name: ${ambulance.DriverName}, Contact: ${ambulance.ContactNumber}, Start Time: ${ambulance.startTime}, End Time: ${ambulance.endTime}`).join("\n")}
                7. Doctor list: ${doctorList.map((doctor) => `Name: ${doctor.name}, Contact: ${doctor.contact}, Start Time: ${doctor.startTime}, End Time: ${doctor.endTime}`).join("\n")}
                8. If the user is asking about ambulance or doctor, use the above lists to answer the query.
                9. Don't use any other tool for ambulance or doctor.
                10. keep it contextual ..
                `,

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

    // for the time being max 3 tool calls
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

        response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: history.slice(-20) as any,
            tools,
            tool_choice: "auto",
        });

        message = response.choices[0].message;
        turns++;
    }


    return openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: history.slice(-20) as any,
        stream: true,
    });
}
