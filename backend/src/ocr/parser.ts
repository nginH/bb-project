import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import Tesseract from "tesseract.js";
import util from "util";

const execAsync = util.promisify(exec);

const TMP_DIR = "./tmp";

async function downloadPdf(url: string, filePath: string) {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    await fs.promises.writeFile(filePath, res.data);
}

async function pdfToImages(pdfPath: string, outputPrefix: string) {
    const cmd = `pdftoppm -png "${pdfPath}" "${outputPrefix}"`;
    await execAsync(cmd);

    const files = await fs.promises.readdir(TMP_DIR);
    return files
        .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith(".png"))
        .map(f => path.join(TMP_DIR, f));
}

async function ocrImage(imagePath: string) {
    const result = await Tesseract.recognize(imagePath, "eng", {
        logger: m => console.log(m.status),
    });

    return result.data.text;
}

function structureText(raw: string) {
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

    return lines.map(line => ({
        text: line,
    }));
}

export async function parsePdfFromUrl(url: string) {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });

    const pdfPath = path.join(TMP_DIR, "file.pdf");
    const imgPrefix = path.join(TMP_DIR, "page");
    await downloadPdf(url, pdfPath);
    const images = await pdfToImages(pdfPath, imgPrefix);
    let fullText = "";
    for (const img of images) {
        const text = await ocrImage(img);
        fullText += text + "\n";
    }
    const json = structureText(fullText);
    return {
        raw: fullText,
        structured: json,
    };
}

type Candidate = {
    applicationNo: string;
    name: string;
    category?: string;
    gender?: string;
    score?: number;
};

function cleanLine(line: string) {
    return line
        .replace(/[|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractCandidates(raw: string): Candidate[] {
    const lines = raw.split("\n").map(cleanLine).filter(Boolean);
    const candidates: Candidate[] = [];
    const appNoRegex = /(ASSAM[0-9O]{5,})/i;
    const scoreRegex = /(\d{1,3}\.\d{2})/;
    const categories = ["GENERAL", "GEN", "CENERAL", "OBC-NCL", "OBC", "SC", "ST", "UR-EWS", "EWS"];
    const genders = ["MALE", "FEMALE", "MEE", "REMAKE"];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const appMatch = line.match(appNoRegex);
        if (!appMatch) continue;

        const appNo = appMatch[1].replace(/O/g, "0"); // Normalize O to 0

        // Parts after the application number
        let remaining = line.split(appMatch[1])[1].trim();

        // If the remaining part is too short or empty, check the next line for name
        if (remaining.length < 3 && i + 1 < lines.length) {
            remaining = lines[i + 1];
        }

        // Try to extract score
        const scoreMatch = remaining.match(scoreRegex);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;

        // Try to extract category
        let foundCategory = "";
        for (const cat of categories) {
            const catRegex = new RegExp(`\\b${cat}\\b`, "i");
            if (catRegex.test(remaining)) {
                foundCategory = cat;
                break;
            }
        }

        // Try to extract gender
        let foundGender = "";
        for (const g of genders) {
            const gRegex = new RegExp(`\\b${g}\\b`, "i");
            if (gRegex.test(remaining)) {
                foundGender = g;
                break;
            }
        }

        // The name is usually between the appNo and the first metadata (cat/gender/score)
        let name = remaining
            .split(new RegExp(`\\b(${categories.join("|")}|${genders.join("|")}|\\d{2}\\.\\d{2})`, "i"))[0]
            .replace(/^[|.\s-]+/, "")
            .trim();

        // If name is still empty or looks like noise, try to look at previous line if it didn't match an appNo
        if (name.length < 3 && i > 0 && !lines[i - 1].match(appNoRegex)) {
            name = lines[i - 1].trim() + " " + name;
        }

        candidates.push({
            applicationNo: appNo,
            name: name.trim(),
            category: foundCategory || undefined,
            gender: foundGender === "MEE" ? "Male" : (foundGender === "REMAKE" ? "Female" : foundGender),
            score: score,
        });
    }

    return candidates;
}

(async () => {
    const url = "http://www.aus.ac.in/wp-content/uploads/2025/09/DocScanner-Sep-4-2025-2-01-PM.pdf";
    const result = await parsePdfFromUrl(url);
    fs.writeFileSync("rawPdf.txt", result.raw)
    const candidates = extractCandidates(result.raw);

    // Read metadata from snapshot.json
    const snapshotPath = path.join(__dirname, "../webscraper/snapshot.json");
    let metadata = {};
    try {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
        metadata = snapshot.meritList.find((m: any) => m.url === url) || { url };
    } catch (e) {
        console.error("Could not read snapshot.json", e);
        metadata = { url };
    }

    const finalOutput = {
        ...metadata,
        candidates
    };

    fs.writeFileSync("candidates.json", JSON.stringify(finalOutput, null, 2));
    console.log("Extracted", candidates.length, "candidates.");
})()