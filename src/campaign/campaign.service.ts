import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Campaign } from './entities/campaign.schema';
import { ApplyCampaignDto } from 'src/payment/dto/apply-campaign.dto';
import { CampaignDiscountType, CampaignScopeType } from 'src/utils/enums';
import { UpdateCampaignnDto } from 'src/payment/dto/update-campaign.dto';
import { CreateCampaignDto } from 'src/payment/dto/create-campaign.dto';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<Campaign>,
  ) {}

  async getAllCampaign(): Promise<Campaign[]> {
    const currDate = new Date();
    const campaign = await this.campaignModel.find({ deleted_at: null });
    const cmp = campaign.filter((cp) => {
      if (
        cp.conditions.start_time <= currDate &&
        cp.conditions.end_time >= currDate
      ) {
        return true;
      }
      return false;
    });
    return cmp;
  }

  async hasActiveCampaign(restaurantId: string): Promise<boolean> {
    const campaigns = await this.campaignModel
      .find({ restaurant_id: restaurantId, deleted_at: null }, { _id: 1 })
      .limit(1);
    return campaigns.length > 0;
  }

  async getCampaignByRestaurantId(restaurantId: string) {
    const currDate = new Date();
    const campaigns = await this.campaignModel.find({
      restaurant_id: restaurantId,
      deleted_at: null,
    });

    return campaigns.filter(
      (cp) =>
        cp.conditions.start_time <= currDate &&
        cp.conditions.end_time >= currDate,
    );
  }

  async getCampaignsByRestaurantIds(restaurantIds: string[]) {
    const currDate = new Date();
    const campaigns = await this.campaignModel.find({
      restaurant_id: { $in: restaurantIds },
      deleted_at: null,
    });

    return campaigns.filter(
      (cp) =>
        cp.conditions.start_time <= currDate &&
        cp.conditions.end_time >= currDate,
    );
  }

  isValidCampaign(
    customer_id: string,
    campaign: Campaign,
    campaignDto: ApplyCampaignDto,
  ) {
    const currDate = new Date();
    return (
      campaign &&
      campaign.deleted_at == null &&
      campaign.conditions.start_time <= currDate &&
      campaign.conditions.end_time >= currDate &&
      campaign.quotas.limit > campaign.unavailable_users.length &&
      campaign.unavailable_users.filter((id) => id === customer_id).length <
        campaign.quotas.total_count_per_count &&
      campaignDto.subtotal >= campaign.conditions.minBasketAmount
    );
  }

  async validateAndApplyCampaign(
    customer_id: string,
    campaignDto: ApplyCampaignDto,
    quote: boolean = false,
  ): Promise<number> {
    let total_discount_value = 0;
    for (const campaign_id of campaignDto.compaign_ids) {
      const campaign = await this.campaignModel.findById(campaign_id);
      if (this.isValidCampaign(customer_id, campaign, campaignDto)) {
        if (!quote) {
          campaign.unavailable_users.push(customer_id);
          campaign.save();
        }

        switch (campaign.discount.type) {
          case CampaignDiscountType.DELIVERY:
            total_discount_value +=
              campaignDto.delivery_fare - campaign.discount.value > 0
                ? campaign.discount.value
                : campaignDto.delivery_fare;
            break;

          case CampaignDiscountType.NET:
            switch (campaign.discount.scope.type) {
              case CampaignScopeType.ORDER:
                const discount_value =
                  campaignDto.subtotal - campaign.discount.value;
                total_discount_value +=
                  discount_value > 0
                    ? campaign.discount.value
                    : campaignDto.subtotal;
                break;
              case CampaignScopeType.CATEGORY:
                break;
              case CampaignScopeType.ITEMS:
                break;
            }
            break;

          case CampaignDiscountType.PERCENTAGE:
            switch (campaign.discount.scope.type) {
              case CampaignScopeType.ORDER:
                const discount_value =
                  campaignDto.subtotal * (campaign.discount.value / 100);
                if (discount_value <= campaign.discount.cap) {
                  total_discount_value += discount_value;
                } else total_discount_value += campaign.discount.cap;
                break;
              case CampaignScopeType.CATEGORY:
                break;
              case CampaignScopeType.ITEMS:
                break;
            }
            break;

          case CampaignDiscountType.TRANSPORT:
            const discount_value =
              campaignDto.subtotal - campaign.discount.value;
            total_discount_value +=
              discount_value > 0
                ? campaign.discount.value
                : campaignDto.subtotal;
            break;

          default:
            break;
        }
      }
    }
    return total_discount_value;
  }

  async getCampaignByOwnerId(id: string): Promise<Campaign[]> {
    const campaign = await this.campaignModel.find({
      restaurant_id: id,
      deleted_at: null,
    });
    return campaign;
  }

  async createCampaign(dto: CreateCampaignDto) {
    const campaign = new this.campaignModel(dto);
    return await campaign.save();
  }

  async deleteCampaign(campaign_id: string, restaurant_id: string) {
    const now = new Date();
    now.setTime(now.getTime() + 7 * 60 * 60 * 1000);

    const campaign = await this.campaignModel.findOne({
      _id: campaign_id,
      restaurant_id: restaurant_id,
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.deleted_at = now;
    await campaign.save();

    return campaign;
  }

  async updateCampaign(dto: UpdateCampaignnDto) {
    const campaign = await this.campaignModel.findByIdAndUpdate(dto.id, dto, {
      new: true,
    });
    return campaign;
  }

  async getCampaignAvailableForRestaurant(
    restaurantId?: string,
  ): Promise<Campaign[]> {
    const currDate = new Date();
    const query = {
      deleted_at: null,
      $or: [{ restaurant_id: restaurantId }, { restaurant_id: null }],
    };

    if (!restaurantId || restaurantId.trim() === '') {
      query.$or = [{ restaurant_id: null }];
    }

    const campaigns = await this.campaignModel.find(query);

    return campaigns.filter(
      (cp) =>
        cp.conditions.start_time <= currDate &&
        cp.conditions.end_time >= currDate,
    );
  }
}
