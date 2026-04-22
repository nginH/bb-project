import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

import dotenv from "dotenv";
dotenv.config();
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

export const index = pinecone.index(process.env.PINECONE_INDEX!);