import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/utils/guards/roles.guard';
import { RequestWithUser } from 'src/utils/interfaces';
import { of } from 'rxjs';

@ApiBearerAuth()
@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('create-collection')
  async createCollection() {
    return await this.chatbotService.createCollection();
  }

  @Get('create-data')
  async startBot() {
    return await this.chatbotService.start();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('ask')
  async askBot(@Body() body: { message: string }, @Req() req: RequestWithUser) {
    return await this.chatbotService.sendMessage(req.user.sub, body.message);
  }
}
