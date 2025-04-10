import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
@Injectable()
export class EmbeddingService {
  private ai: GoogleGenAI;
  private readonly API_URL = 'http://localhost:8000/embed';

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API,
    });
  }

  async generateEmbedding(text: string): Promise<any> {
    const response = await this.ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    return response.embeddings[0].values;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const response = await axios.post(this.API_URL, { text });
    return response.data.embedding;
  }
}
