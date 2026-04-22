import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

type SearchFilters = {
    category?: string;
    listType?: string;
    minScore?: number;
};

export async function pgAdmissionSearch(
    query: string,
    filters?: SearchFilters
) {
    const client = await pool.connect();
    console.log("calling pg admission detail tools");

    try {
        const search = query.trim();

        const conditions: string[] = [];
        const values: any[] = [];
        let idx = 1;

        conditions.push(`
      similarity(c.name, $${idx}) > 0.2 OR
      similarity(c.application_no, $${idx}) > 0.3 OR
      similarity(d.title, $${idx}) > 0.2
    `);
        values.push(search);
        idx++;

        if (filters?.category) {
            conditions.push(`c.category = $${idx}`);
            values.push(filters.category.toUpperCase());
            idx++;
        }

        if (filters?.listType) {
            conditions.push(`c.list_type = $${idx}`);
            values.push(filters.listType);
            idx++;
        }

        if (filters?.minScore) {
            conditions.push(`c.score >= $${idx}`);
            values.push(filters.minScore);
            idx++;
        }

        const sql = `
      SELECT 
        c.name,
        c.application_no,
        c.category,
        c.gender,
        c.score,
        c.rank,
        c.list_type,

        d.title AS document_title,
        d.url AS document_url,

        GREATEST(
          similarity(c.name, $1) * 3,
          similarity(c.application_no, $1) * 4,
          similarity(d.title, $1) * 2
        ) AS relevance

      FROM candidates c
      JOIN documents d ON c.document_id = d.id

      WHERE ${conditions.join(" AND ")}

      ORDER BY relevance DESC, c.score DESC NULLS LAST
      LIMIT 20;
    `;

        const res = await client.query(sql, values);

        return {
            count: res.rowCount,
            results: res.rows,
        };

    } catch (error) {
        console.error("Search error:", (error as Error).message);
        return { error: "Search failed" };
    } finally {
        client.release();
    }
}

export const pgAdmissionTool = {
    type: "function",
    function: {
        name: "pg_admission_search",
        description:
            "Search Assam University admission database. Supports fuzzy name search, application number lookup, and department-level queries. Can filter by category, list type, and score.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Student name, application ID, or department name",
                },
                category: {
                    type: "string",
                    description: "Filter by category (GENERAL, OBC-NCL, SC, ST, EWS)",
                },
                listType: {
                    type: "string",
                    description: "Selected or Waiting",
                },
                minScore: {
                    type: "number",
                    description: "Minimum score filter",
                },
            },
            required: ["query"],
        },
    },
};