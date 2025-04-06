import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { SystemPolicy } from './prompts/system-policy.prompt';
import { Cron } from '@nestjs/schedule';

interface ChatSession {
  coords: [number, number];
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
  ) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API'),
    });
  }

  async start(userId: string, userCoords: [number, number]) {
    const existingSession = this.chatSessions.get(userId);
    if (existingSession) {
      if (
        JSON.stringify(existingSession.coords) === JSON.stringify(userCoords)
      ) {
        console.log('Chat session already exists for this user');
        return {
          message: 'bot already started',
        };
      } else {
        this.chatSessions.delete(userId);
      }
    }

    const menus =
      await this.restaurantService.getAllMenusWithRestaurantInfo(userCoords);

    const session: ChatSession = {
      coords: userCoords,
      chat: this.ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          temperature: 0.4,
        },
      }),
      lastActivity: new Date(),
    };

    await session.chat.sendMessage({
      message: `

      ${SystemPolicy.policy}

      Dưới đây là danh sách món ăn:
      ${JSON.stringify(menus, null, 2)}

      ${SystemPolicy.format_response}
      `,
    });

    this.chatSessions.set(userId, session);

    return {
      message: 'bot started',
    };
  }

  extractJsonString(input: string): string {
    const match = input.match(/{[\s\S]*}/);
    return match ? match[0] : '{}';
  }

  async sendMessage(
    userId: string,
    message: string,
    userCoords: [number, number],
  ) {
    let chatSession = this.chatSessions.get(userId);

    if (
      !chatSession ||
      (chatSession &&
        JSON.stringify(chatSession.coords) !== JSON.stringify(userCoords))
    ) {
      await this.start(userId, userCoords);
      return await this.sendMessage(userId, message, userCoords);
    } else if (
      JSON.stringify(chatSession.coords) === JSON.stringify(userCoords)
    ) {
      const response = await chatSession.chat.sendMessage({ message });
      chatSession.lastActivity = new Date();

      const responseText = this.extractJsonString(response.text);
      return JSON.parse(responseText);
    } else {
      return {
        message: 'GoPee đang cập nhật menu bạn quay lại sau nhé',
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
