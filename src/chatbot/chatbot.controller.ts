import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/utils/guards/roles.guard';
import { RequestWithUser } from 'src/utils/interfaces';

@ApiBearerAuth()
@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('create-chat')
  async startBot(
    @Req() req: RequestWithUser,
    @Query() query: { coords: string },
  ) {
    const coords = query.coords.split(',');
    return await this.chatbotService.start(req.user.sub, [
      parseFloat(coords[0]),
      parseFloat(coords[1]),
    ]);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('ask')
  async askBot(
    @Body() body: { message: string; coords: [number, number] },
    @Req() req: RequestWithUser,
  ) {
    return await this.chatbotService.sendMessage(
      req.user.sub,
      body.message,
      body.coords,
    );
  }
}
