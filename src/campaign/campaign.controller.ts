import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';

@ApiTags('Campaign')
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('all')
  getCampaign() {
    return this.campaignService.getAllCampaign();
  }

  @Get('')
  getCampaignAvailableForRestaurant(@Query() query: { restaurantId: string }) {
    return this.campaignService.getCampaignAvailableForRestaurant(
      query.restaurantId,
    );
  }
}
