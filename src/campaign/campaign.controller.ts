import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';

@ApiTags('Campaign')
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('/')
  getCampaign() {
    return this.campaignService.getAllCampaign();
  }
}
