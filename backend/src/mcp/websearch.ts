export async function webSearch(query: string) {
    const searchQuery = `${query} in Assam University, Silchar`;

    const myHeaders = new Headers();
    myHeaders.append("accept-language", "en-US,en;q=0.7");
    myHeaders.append("priority", "u=1, i");
    myHeaders.append("referer", `https://search.brave.com/search?q=${encodeURIComponent(searchQuery)}&source=web&summary=1&conversation=08fe18bff9dc88afd89afe952daca450f9eb`);
    myHeaders.append("sec-ch-ua", "\"Brave\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"");
    myHeaders.append("sec-ch-ua-mobile", "?0");
    myHeaders.append("sec-ch-ua-platform", "\"macOS\"");
    myHeaders.append("sec-fetch-dest", "empty");
    myHeaders.append("sec-fetch-mode", "cors");
    myHeaders.append("sec-fetch-site", "same-origin");
    myHeaders.append("sec-gpc", "1");
    myHeaders.append("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36");

    const requestOptions: RequestInit = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    const maxRetry = 8;
    let res: Response | null = null;

    for (let i = 0; i < maxRetry; i++) {
        try {
            res = await fetch(`https://search.brave.com/api/chatllm/with_ask/enrichments?key=%7B%22v%22%3A%222%22%2C%22query%22%3A%22${encodeURIComponent(searchQuery)}%22%2C%22country%22%3A%22in%22%2C%22language%22%3A%22en%22%2C%22safesearch%22%3A%22moderate%22%2C%22results_hash%22%3A%22d1cbd51be856e4901ecc60268014919a35bc1d9677aba4b3c52747eab79288ad%22%2C%22experimental_inline_refs%22%3Atrue%7D&conversation=08fe18bff9dc88afd89afe952daca450f9eb`, requestOptions);

            if (res.status === 429) {
                console.log(`Rate limited (429), retrying in ${i + 1}s...`);
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }

            if (!res.ok) {
                console.warn(`Brave Search API returned ${res.status}`);
            }

            break;
        } catch (error) {
            console.error("Fetch attempt failed:", error);
            if (i === maxRetry - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    if (!res) throw new Error("Failed to get response after retries");

    try {
        const data = await res.json();
        console.log("websearch success");
        return {
            answer: data.raw_response || "No direct answer found.",
            sources: data.reference_urls || []
        };
    } catch (e) {
        console.error("Failed to parse Brave Search JSON response.");
        return { answer: "Error parsing search results.", sources: [] };
    }
}

export const webSearchTool = {
    type: "function",
    function: {
        name: "web_search",
        description: "Search the web for real-time information, news, and facts about Assam University and related topics.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query to look up on the web.",
                },
            },
            required: ["query"],
        },
    },
};


// (async () => {
//     const result = await webSearch("What is the admission process for Assam University?");
// })()