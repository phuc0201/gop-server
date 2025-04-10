import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { RestaurantModule } from 'src/restaurant/restaurant.module';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vertor_store.service';

@Module({
  imports: [RestaurantModule],
  providers: [ChatbotService, EmbeddingService, VectorStoreService],
  controllers: [ChatbotController],
})
export class ChatbotModule {}
