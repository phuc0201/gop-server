import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { RestaurantModule } from 'src/restaurant/restaurant.module';
import { RestaurantService } from 'src/restaurant/restaurant.service';

@Module({
  imports: [RestaurantModule],
  providers: [ChatbotService],
  controllers: [ChatbotController],
})
export class ChatbotModule {}
