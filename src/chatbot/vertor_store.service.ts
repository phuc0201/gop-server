import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
@Injectable()
export class VectorStoreService {
  private client: QdrantClient;
  private collectionName = 'chatbot-food-collection';
  constructor(private readonly configService: ConfigService) {
    this.client = new QdrantClient({
      url: this.configService.get('QDRANT_URL'),
      apiKey: this.configService.get('QDRANT_API_KEY'),
    });
  }

  async createCollection() {
    try {
      const response = await this.client.getCollections();
      const collectionNames = response.collections.map(
        (collection) => collection.name,
      );

      if (!collectionNames.includes(this.collectionName)) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768,
            distance: 'Cosine',
          },
        });
        return {
          status: 'success',
          message: `Collection ${this.collectionName} created successfully.`,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Collection ${this.collectionName} already exists.`,
        error: error.message,
      };
    }
  }

  async upsertVector(points: any[]) {
    try {
      return await this.client.upsert(this.collectionName, {
        wait: true,
        points: points,
      });
    } catch (error) {
      return error;
    }
  }

  async searchVector(vector: number[]) {
    const result = await this.client.search(this.collectionName, {
      vector,
      limit: 10,
      with_payload: true,
      score_threshold: 0.86,
      params: {
        hnsw_ef: 3000,
        exact: true,
      },
    });
    return result;
  }
}
