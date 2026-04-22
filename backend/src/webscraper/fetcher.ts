import * as cheerio from "cheerio";
import crypto from "crypto";
import fs from "fs";

export type Item = {
    id: string;
    title: string;
    url: string;
};

export type Result = {
    meritList: Item[];
    notices: Item[];
};

async function fetchPage(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    return res.text();
}

function generateId(text: string, url: string) {
    return crypto.createHash("sha256").update(text + url).digest("hex");
}

function parseSection($: cheerio.CheerioAPI, selector: string): Item[] {
    const data: Item[] = [];

    $(selector)
        .find(".merit-list")
        .each((_, el) => {
            const anchor = $(el).find("a");

            const title = anchor.text().trim();
            const url = anchor.attr("href")?.trim();

            if (!title || !url) return;

            data.push({
                id: generateId(title, url),
                title,
                url,
            });
        });

    return data;
}

export async function admissionFetcher(): Promise<Result> {
    const html = await fetchPage("http://www.aus.ac.in/ausadmission.php/");
    const $ = cheerio.load(html);

    const meritList = parseSection($, ".merit-list-section");
    const notices = parseSection($, ".notice-section");

    return { meritList, notices };
}

(async () => {
    const data = await admissionFetcher();
    fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
})();