import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { exec } from "child_process";
import util from "util";
import { ImageAnnotatorClient } from "@google-cloud/vision";

const execAsync = util.promisify(exec);
const visionClient = new ImageAnnotatorClient();

const TMP_DIR = "./tmp";
const RAW_DIR = "./raw-cache";

// ===== CONFIG =====
const INPUT_JSON = "/Users/harshanand/Downloads/development/bb-v2-bot/backend/src/webscraper/snapshot.json"; // your file
const OUTPUT_JSON = "/Users/harshanand/Downloads/development/bb-v2-bot/backend/src/ocr/google/output_raw.json";

// ===== UTILS =====

function hashUrl(url: string) {
    return crypto.createHash("sha256").update(url).digest("hex");
}

async function ensureDirs() {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });
    await fs.promises.mkdir(RAW_DIR, { recursive: true });
}

// ===== DOWNLOAD =====

async function downloadFile(url: string, filePath: string) {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    await fs.promises.writeFile(filePath, res.data);
}

// ===== PDF → IMAGES =====

async function pdfToImages(pdfPath: string, outputPrefix: string) {
    const cmd = `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`;
    await execAsync(cmd);

    const files = await fs.promises.readdir(TMP_DIR);

    return files
        .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith(".png"))
        .map(f => path.join(TMP_DIR, f));
}

// ===== OCR =====

async function ocrImage(imagePath: string) {
    const [result] = await visionClient.documentTextDetection(imagePath);
    return result.fullTextAnnotation?.text || "";
}

// ===== OCR HANDLER =====

async function runOcr(url: string): Promise<string> {
    const id = hashUrl(url);
    const ext = url.split(".").pop()?.toLowerCase();

    const filePath = path.join(TMP_DIR, `${id}.${ext}`);

    await downloadFile(url, filePath);

    // 🔥 handle image directly
    if (["jpg", "jpeg", "png"].includes(ext || "")) {
        const text = await ocrImage(filePath);
        await fs.promises.unlink(filePath).catch(() => {});
        return text;
    }

    // 🔥 handle PDF
    if (ext === "pdf") {
        const imgPrefix = path.join(TMP_DIR, id);
        const images = await pdfToImages(filePath, imgPrefix);

        console.log(`OCR: Processing ${images.length} pages for ${id}`);
        
        // 🚀 Parallelize page OCR
        const pageTexts = await Promise.all(images.map(img => ocrImage(img)));
        
        // 🧹 Cleanup images
        for (const img of images) {
            await fs.promises.unlink(img).catch(() => {});
        }
        // Also cleanup PDF
        await fs.promises.unlink(filePath).catch(() => {});

        return pageTexts.join("\n");
    }

    throw new Error("Unsupported file type: " + ext);
}

// ===== CHECKPOINT =====

async function getOrCreateRaw(url: string): Promise<string> {
    const id = hashUrl(url);
    const filePath = path.join(RAW_DIR, `${id}.txt`);

    // ✅ already processed
    if (fs.existsSync(filePath)) {
        console.log("CACHE HIT:", url);
        return fs.readFileSync(filePath, "utf-8");
    }

    console.log("OCR:", url);
    const text = await runOcr(url);

    if (!text || text.length < 20) {
        throw new Error("OCR failed / empty");
    }

    await fs.promises.writeFile(filePath, text);
    return text;
}

// ===== CONCURRENCY LIMITER =====
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

// ===== MAIN =====

async function main() {
    await ensureDirs();

    const input = JSON.parse(
        fs.readFileSync(INPUT_JSON, "utf-8")
    );

    console.log(`Processing ${input.meritList.length} items...`);

    // 🚀 Parallelize merit list items with limit
    const results = await mapWithLimit(
        input.meritList as any[], 
        5, // Concurrency limit
        async (item) => {
            try {
                const raw = await getOrCreateRaw(item.url);
                console.log("DONE:", item.title);
                return {
                    ...item,
                    rawText: raw,
                };
            } catch (err) {
                console.error("FAILED:", item.url, err);
                return {
                    ...item,
                    error: true,
                    errorMessage: (err as Error).message
                };
            }
        }
    );

    await fs.promises.writeFile(
        OUTPUT_JSON,
        JSON.stringify({ meritList: results }, null, 2)
    );

    console.log("ALL DONE. Results written to", OUTPUT_JSON);
}

main();