import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './entities/campaign.schema';
import { CampaignService } from './campaign.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
