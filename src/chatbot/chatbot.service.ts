import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createUserContent, GoogleGenAI } from '@google/genai';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { SystemPolicy } from './prompts/system-policy.prompt';
import { Cron } from '@nestjs/schedule';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vertor_store.service';
import { v4 as uuidv4 } from 'uuid';
interface ChatSession {
  chat: any;
  lastActivity: Date;
}

@Injectable()
export class ChatbotService {
  private ai: GoogleGenAI;

  private chatSessions: Map<string, ChatSession> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly restaurantService: RestaurantService,
    private readonly embeddingService: EmbeddingService,
    private readonly vertorStoreService: VectorStoreService,
  ) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API'),
    });
  }

  splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async streamChat() {
    const session = await this.ai.live.connect({
      model: 'gemini-2.0-flash',
      callbacks: {
        onopen: () => {
          console.log('Connected to the socket.');
        },
        onmessage: (message) => {
          console.log('Received message:', message);
        },
        onerror: (error) => {
          console.error('Error:', error);
        },
        onclose: (e: CloseEvent) => {
          console.log('Connection closed.');
        },
      },
    });

    return session;
  }

  async createCollection() {
    return await this.vertorStoreService.createCollection();
  }

  async start() {
    const menus = await this.restaurantService.getAllMenusWithRestaurantInfo();

    const foodItems = menus.flatMap((restaurant) =>
      restaurant.foodItems.map((food) => ({
        food: food,
        restaurant: {
          _id: restaurant._id,
          restaurant_name: restaurant.restaurant_name,
          location: restaurant.location,
        },
      })),
    );

    const points: {
      id: string;
      vector: number[];
      payload: any;
    }[] = [];

    for (const { food, restaurant } of foodItems) {
      const prompt = `món ${food.name} - mô tả ${food.bio} - bán tại ${restaurant.restaurant_name}`;

      const embedding = await this.embeddingService.getEmbedding(prompt);

      points.push({
        id: uuidv4(),
        vector: embedding,
        payload: {
          restaurant_id: restaurant._id,
          restaurant_name: restaurant.restaurant_name,
          addres: restaurant.location['address'],
          food_id: food.id,
          food_name: food.name,
          price: food.price,
        },
      });
    }

    const batches = this.splitIntoBatches(points, 100);

    for (const batch of batches) {
      await this.vertorStoreService.upsertVector(batch);
    }

    return {
      message: `Upserted ${points.length} items in ${batches.length} batches`,
    };
  }

  async suggestFood(query: string) {
    const embedding = await this.embeddingService.getEmbedding(query);
    const results = await this.vertorStoreService.searchVector(embedding);

    const restaurantsMap = new Map<string, any>();

    results.forEach((result) => {
      const restaurantId = result.payload.restaurant_id as string;
      if (restaurantId) {
        if (!restaurantsMap.has(restaurantId)) {
          restaurantsMap.set(restaurantId, {
            restaurant_id: restaurantId,
            retaurant_name: result.payload.restaurant_name,
            restaurant_address: result.payload.address,
            fooditems: [],
          });
        }

        restaurantsMap
          .get(restaurantId)
          .fooditems.push(
            `name: ${result.payload.food_name} - price: ${result.payload.price} - score_similar: ${result.score};`,
          );
      }
    });

    return Array.from(restaurantsMap.values());
  }

  extractJsonString(input: string): string {
    const match = input.match(/{[\s\S]*}/);
    return match ? match[0] : '{}';
  }

  async sendMessage(userId: string, message: string) {
    const foods = await this.suggestFood(message);

    let chatSession = this.chatSessions.get(userId);
    if (!chatSession) {
      const prompts = `
        ${SystemPolicy.policy}

        ${SystemPolicy.format_response}

        **Danh sách món ăn gốc:**

        ${JSON.stringify(foods.map((food) => food))}

        ***********************

        Dựa vào danh sách món ăn để tìm ra nhà hàng có món ăn phù hợp với yêu cầu của khách

        Nếu danh sách rỗng thì hãy đưa ra một vài đề xuất cho khách chọn
        

        Câu hỏi mới của người dùng: ${message}
      `;
      const session = this.ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          temperature: 0.5,
        },
      });

      this.chatSessions.set(userId, {
        chat: session,
        lastActivity: new Date(),
      });

      const response = await session.sendMessage({ message: prompts });
      const parsedResponse = JSON.parse(this.extractJsonString(response.text));
      const restaurants = await this.restaurantService.getRestaurantsForChatbot(
        parsedResponse.restaurants,
      );

      return {
        message: parsedResponse.message,
        restaurants: restaurants,
      };
    } else {
      const prompts = `
        **Thêm các món sau vào danh sách món ăn gốc:**

        ${JSON.stringify(foods.map((food) => food))}
        
        ******************************************

        Câu hỏi mới của người dùng: ${message}
      `;
      const response = await chatSession.chat.sendMessage({ message: prompts });
      this.chatSessions.set(userId, {
        ...chatSession,
        lastActivity: new Date(),
      });

      const parsedResponse = JSON.parse(this.extractJsonString(response.text));
      const restaurants = await this.restaurantService.getRestaurantsForChatbot(
        parsedResponse.restaurants,
      );

      return {
        message: parsedResponse.message,
        restaurants: restaurants,
      };
    }
  }

  @Cron('0 * * * * *')
  cleanupInactiveSessions() {
    console.log('Running cleanup of inactive chat sessions');
    const now = new Date();

    this.chatSessions.forEach((session, userId) => {
      const inactiveMinutes =
        (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);

      if (inactiveMinutes >= 10) {
        console.log(`Removing inactive chat session for user ${userId}`);
        this.chatSessions.delete(userId);
      }
    });
  }
}
