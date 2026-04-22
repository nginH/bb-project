import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function ensureTables() {
    await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT,
      url TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      document_id TEXT REFERENCES documents(id),
      application_no TEXT,
      name TEXT,
      category TEXT,
      gender TEXT,
      score NUMERIC,
      rank INT,
      list_type TEXT,
      UNIQUE(document_id, application_no)
    );
  `);
}



type Candidate = {
    applicationNo?: string;
    name?: string;
    category?: string;
    gender?: string;
    score?: number;
    rank?: number;
    listType?: string;
};

type MeritItem = {
    title: string;
    url: string;
    data: Candidate[];
};

type Input = {
    meritList: MeritItem[];
};



function hash(input: string) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

function chunk<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size));
    }
    return res;
}



async function insertDocument(item: MeritItem) {
    const id = hash(item.url);

    await pool.query(
        `
    INSERT INTO documents (id, title, url)
    VALUES ($1, $2, $3)
    ON CONFLICT (url) DO NOTHING
    `,
        [id, item.title, item.url]
    );

    return id;
}


async function insertCandidatesBatch(
    documentId: string,
    candidates: Candidate[]
) {
    const client = await pool.connect();

    try {
        const batches = chunk(candidates, 500);

        for (const batch of batches) {
            await client.query("BEGIN");

            const values: any[] = [];
            const placeholders: string[] = [];

            batch.forEach((c, i) => {
                const base = i * 9;

                placeholders.push(
                    `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
                );

                values.push(
                    hash(documentId + (c.applicationNo || "") + (c.name || "")),
                    documentId,
                    c.applicationNo || null,
                    c.name || null,
                    c.category?.toUpperCase() || null,
                    c.gender || null,
                    c.score ?? null,
                    c.rank ?? null,
                    c.listType || null
                );
            });

            const query = `
        INSERT INTO candidates (
          id,
          document_id,
          application_no,
          name,
          category,
          gender,
          score,
          rank,
          list_type
        )
        VALUES ${placeholders.join(",")}
        ON CONFLICT (document_id, application_no) DO NOTHING
      `;

            await client.query(query, values);

            await client.query("COMMIT");
        }

    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}



async function main() {
    await ensureTables();
    const filePath = path.join(__dirname, "output_structured.json");

    const input: Input = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    console.log("Uploading:", input.meritList.length, "documents");

    for (const item of input.meritList) {
        try {
            const docId = await insertDocument(item);

            if (!item.data || item.data.length === 0) {
                console.log("No candidates:", item.title);
                continue;
            }

            await insertCandidatesBatch(docId, item.data);

            console.log(
                "Inserted:",
                item.title,
                "|",
                item.data.length,
                "candidates"
            );

        } catch (err) {
            console.error("FAILED:", item.url, err);
        }
    }

    console.log("DONE");
    process.exit(0);
}

main();