import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Campaign } from './entities/campaign.schema';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<Campaign>,
  ) {}

  async getAllCampaign(): Promise<Campaign[]> {
    const currDate = new Date();
    const campaign = await this.campaignModel.find();
    const cmp = campaign.filter((cp) => {
      if (
        cp.conditions.start_time <= currDate &&
        cp.conditions.end_time >= currDate
      ) {
        return true;
      }
      return false;
    });
    return campaign;
  }

  async hasActiveCampaign(restaurantId: string): Promise<boolean> {
    const campaigns = await this.campaignModel
      .find({ restaurant_id: restaurantId }, { _id: 1 })
      .limit(1);
    return campaigns.length > 0;
  }

  async getCampaignsByRestaurantIds(restaurantIds: string[]) {
    return await this.campaignModel
      .find({ restaurant_id: { $in: restaurantIds } }, { restaurant_id: 1 })
      .limit(1);
  }
}
