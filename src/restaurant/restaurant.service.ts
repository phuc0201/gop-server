import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model, Types } from 'mongoose';
import { AccountServiceAbstract } from 'src/auth/account.abstract.service';
import { OrderFoodItems } from 'src/order/entities/order_food_items.schema';
import {
  BikeFare,
  RestaurantStatus,
  SortStatus,
  VehicleType,
} from 'src/utils/enums';
import { FirebaseService } from 'src/utils/firebase/firebase.service';
import { VietMapService } from 'src/utils/map-api/viet-map.service';
import { LocationObject } from 'src/utils/subschemas/location.schema';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { CreateRestaurantCategoryDto } from './dto/create-restaurant-category.dto';
import { ReviewDto } from './dto/review.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { UpdateRestaurantCategoryDto } from './dto/update-restaurant-category.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CuisineCategories } from './entities/cuisine_categories.schema';
import { Restaurant, RestaurantDocument } from './entities/restaurant.schema';
import { RestaurantCategory } from './entities/restaurant_category.schema';
import { Review } from './entities/review.schema';
import { FoodItemService } from './food_item.service';
import { ModifierService } from './modifier.service';
import { RestaurantCategoryService } from './restaurant_category.service';
import { CampaignService } from 'src/campaign/campaign.service';
import { Modifier } from './entities/modifier.schema';

@Injectable()
export class RestaurantService extends AccountServiceAbstract<Restaurant> {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<Restaurant>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(CuisineCategories.name)
    private readonly cuisineModel: Model<CuisineCategories>,
    private readonly restaurantCategoryService: RestaurantCategoryService,
    private readonly foodItemService: FoodItemService,
    private readonly modifierService: ModifierService,
    private vietmapService: VietMapService,
    private firebaseService: FirebaseService,
    private campaignService: CampaignService,
  ) {
    super(restaurantModel);
  }
  async getAllMenusWithRestaurantInfo(userCoords: [number, number]) {
    return await this.restaurantModel.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: userCoords,
          },
          distanceField: 'distance',
          spherical: true,
          maxDistance: 20000, // 20km in meters
        },
      },
      {
        $match: {
          deleted: null,
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'reviewable_id',
          as: 'reviews',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          rating: {
            $ifNull: [{ $avg: '$reviews.rating' }, 0],
          },
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: 'restaurant_id',
          as: 'campaigns',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'restaurantcategories',
          localField: 'restaurant_categories',
          foreignField: '_id',
          as: 'restaurant_categories',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'fooditems',
          localField: 'restaurant_categories.food_items',
          foreignField: '_id',
          as: 'foodItems',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'modifiergroups',
          localField: 'foodItems.modifier_groups',
          foreignField: '_id',
          as: 'modifierGroups',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'modifiers',
          localField: 'modifierGroups.modifier',
          foreignField: '_id',
          as: 'modifiers',
          pipeline: [
            {
              $match: {
                deleted: null,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          hasCampaign: { $gt: [{ $size: '$campaigns' }, 0] },
          foodItems: {
            $map: {
              input: '$foodItems',
              as: 'foodItem',
              in: {
                id: '$$foodItem._id',
                name: '$$foodItem.name',
                price: '$$foodItem.price',
                image: '$$foodItem.image',
                modifier_groups: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$modifierGroups',
                        as: 'mg',
                        cond: {
                          $in: ['$$mg._id', '$$foodItem.modifier_groups'],
                        },
                      },
                    },
                    as: 'mg',
                    in: {
                      id: '$$mg._id',
                      name: '$$mg.name',
                      min: '$$mg.min',
                      max: '$$mg.max',
                      modifier: {
                        $filter: {
                          input: '$modifiers',
                          as: 'mod',
                          cond: {
                            $in: ['$$mod._id', '$$mg.modifier'],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          status: 1,
          restaurant_name: 1,
          location: 1,
          avatar: 1,
          distance: 1,
          rating: 1,
          hasCampaign: 1,
          foodItems: {
            id: 1,
            name: 1,
            price: 1,
            image: 1,
            modifier_groups: {
              id: '$_id',
              name: 1,
              min: 1,
              max: 1,
              modifier: {
                name: 1,
                price: 1,
              },
            },
          },
        },
      },
    ]);
  }

  async checkRestaurantAndFoodAvailability(
    restaurantId: string,
    foodItems: OrderFoodItems[],
  ): Promise<{
    isRestaurantOpen: boolean;
    items: {
      food_id: string;
      food_name: string;
      image: string;
      price: number;
      quantity: number;
      modifiers: Modifier[];
    }[];
  }> {
    const restaurant = await this.findOneById(restaurantId);

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const isRestaurantOpen = restaurant.status !== RestaurantStatus.CLOSED;

    const availableFoods = await Promise.all(
      foodItems.map(async (item) => {
        const food = await this.foodItemService.findOneById(item.food_id);

        if (!food) {
          return null;
        }

        const availableModifiers = await Promise.all(
          item.modifiers.map(async (modifierId) => {
            const modifierExists =
              await this.modifierService.findOneById(modifierId);
            return modifierExists ? modifierExists : null;
          }),
        );

        return {
          food_id: item.food_id,
          food_name: food.name,
          image: food.image,
          quantity: item.quantity,
          price: food.price,
          modifiers: availableModifiers.filter((mod) => mod !== null),
        };
      }),
    );

    return {
      isRestaurantOpen,
      items: availableFoods.filter((food) => food !== null),
    };
  }

  async getRestaurantInfoInOrders(resIDs: string[]) {
    const restaurants = await this.restaurantModel
      .find({
        _id: { $in: resIDs },
      })
      .select('restaurant_name avatar status location')
      .lean()
      .exec();
    return restaurants;
  }

  async getRestaurantInfoInOrder(resIDs: string) {
    const restaurants = await this.restaurantModel
      .findById(resIDs)
      .select('restaurant_name avatar status location')
      .lean()
      .exec();
    return restaurants;
  }

  getFoodImagesAndNames(iDs: string[]) {
    return this.foodItemService.getFoodImagesAndNames(iDs);
  }

  async getReivewsByRes(resId: string) {
    const objectId = new ObjectId(resId);
    const reviews = await this.reviewModel.aggregate([
      {
        $match: {
          reviewable_id: objectId,
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'owner_id',
          foreignField: '_id',
          as: 'customer',
          pipeline: [
            {
              $project: {
                full_name: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$customer',
      },
    ]);
    return reviews;
  }

  async createReview(dto: ReviewDto) {
    const review = await new this.reviewModel(dto).save();
    return review;
  }

  async findFoodDetailsFromOrder(orderFoodItems: OrderFoodItems[]) {
    const newOrderFoodItems = await Promise.all(
      orderFoodItems.map(async (item) => {
        const food = await this.foodItemService.findOneById(item.food_id);

        return {
          food_id: item.food_id,
          quantity: item.food_id,
          image: food.image,
          name: food.name,
        };
      }),
    );

    return newOrderFoodItems;
  }

  async updateRestaurant(
    id: string,
    dto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    const restaurant = await this.update(
      id,
      dto as Partial<UpdateRestaurantDto>,
    );
    return restaurant;
  }

  async updateActiveStatus(id: string, status: RestaurantStatus) {
    await this.update(id, { status });

    return {
      msg: 'update successfully',
    };
  }

  async findCategoryByRestaurant(id: string) {
    const restaurant = await this.restaurantModel
      .findById(id)
      .populate({
        path: 'restaurant_categories',
        model: 'RestaurantCategory',
      })
      .exec();
    return restaurant.restaurant_categories;
  }

  async findCategoriesByCustomer(id: string) {
    const objectId = new ObjectId(id);
    const categories = await this.restaurantModel.aggregate([
      {
        $match: {
          _id: objectId,
        },
      },
      {
        $unwind: '$restaurant_categories',
      },
      {
        $lookup: {
          from: 'restaurantcategories',
          localField: 'restaurant_categories',
          foreignField: '_id',
          as: 'restaurantCategories',
          pipeline: [
            {
              $project: {
                image: 1,
                name: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$restaurantCategories',
      },
      {
        $group: {
          _id: '$_id',
          restaurant_categories: {
            $push: '$restaurantCategories',
          },
        },
      },
    ]);
    return categories[0].restaurant_categories;
  }

  async addCategory(
    restaurant_id: string,
    dto: CreateRestaurantCategoryDto,
  ): Promise<RestaurantCategory> {
    const category = await this.restaurantCategoryService.createCategory(dto);

    await this.restaurantModel
      .findByIdAndUpdate(
        restaurant_id,
        {
          $push: {
            restaurant_categories: category._id,
          },
        },
        { new: true },
      )
      .exec();

    return category;
  }

  async food_calculateFare(dto: OrderFoodItems): Promise<number> {
    let fare = await this.foodItemService.getFoodItemPrice(dto.food_id);

    for (const item of dto.modifiers as string[]) {
      fare += await this.modifierService.getModifierPrice(item);
    }
    fare = fare * dto.quantity;
    return fare;
  }

  async updateCategory(
    restaurant_id: string,
    cate_id: string,
    dto: UpdateRestaurantCategoryDto,
  ): Promise<any> {
    const restaurant = await this.findOneByCondition({
      _id: restaurant_id,
      restaurant_categories: cate_id,
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant or Category not found');
    }
    const category = await this.restaurantCategoryService.updateCategory(
      cate_id,
      dto,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async deleteCategory(category_id: string, restaurant_id: string) {
    const restaurant = await this.findOneByCondition({
      _id: restaurant_id,
      restaurant_categories: category_id,
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant or Category not found');
    }

    const new_cate = restaurant.restaurant_categories.filter(
      (cate_id) => cate_id != category_id,
    ) as RestaurantCategory[];

    await this.update(restaurant_id, {
      restaurant_categories: new_cate,
    });

    return await this.restaurantCategoryService.deleteCategory(category_id);
  }

  async getFooditemDetails(id: string) {
    const foodDetails = await this.foodItemService.getFoodItemDetails(id);
    return foodDetails;
  }

  async createFoodItem(restaurant_id: string, dto: CreateFoodItemDto) {
    const restaurant = await this.findOneById(restaurant_id);
    if (restaurant) {
      const foodItem = await this.foodItemService.createFoodItem(dto);
      await this.restaurantCategoryService.addFoodItem(
        foodItem._id,
        dto.category_id,
      );
      return foodItem;
    } else throw new NotFoundException('Restaurant not found');
  }

  async getRestaurantLocation(restaurant_id: string) {
    const restaurant = await this.findOneById(restaurant_id);
    return restaurant.location;
  }

  async updateFoodItemImg(foodItem_id: string, img: Express.Multer.File) {
    const url = await this.firebaseService.uploadFile(foodItem_id, img);
    await this.foodItemService.updateFoodItemImg(foodItem_id, url);
    return {
      imgUrl: url,
    };
  }

  async updateCategoryImg(cate_id: string, img: Express.Multer.File) {
    const url = await this.firebaseService.uploadFile(cate_id, img);
    await this.restaurantCategoryService.updateImage(cate_id, url);
    return {
      imgUrl: url,
    };
  }

  async updateFoodItem(foodItem: UpdateFoodItemDto) {
    const updateFoodItemPromise = this.foodItemService.updateFoodItem(foodItem);
    const changeFoodItemCategoryPromise =
      this.restaurantCategoryService.updateFoodItemCategory(
        foodItem._id,
        foodItem.category_id,
      );

    const [newFoodItem] = await Promise.all([
      updateFoodItemPromise,
      changeFoodItemCategoryPromise,
    ]);

    return newFoodItem;
  }

  async deleteFoodItem(restaurant_id: string, category_id, food_id: string) {
    const restaurant = await this.findOneByCondition({
      _id: restaurant_id,
      restaurant_categories: category_id,
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant or Category not found');
    }

    const newFoodItem = await this.restaurantCategoryService.deleteFoodItem(
      category_id,
      food_id,
    );

    return newFoodItem;
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async calculateRestaurantAverageRating(restaurantIds: string[]) {
    const resIds = restaurantIds.map((id) => new Types.ObjectId(id));

    return await this.reviewModel.aggregate([
      { $match: { reviewable_id: { $in: resIds } } },
      {
        $group: {
          _id: '$reviewable_id',
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $project: {
          restaurantId: '$_id',
          averageRating: { $round: ['$averageRating', 2] },
          _id: 0,
        },
      },
    ]);
  }

  async findRestaurantsNearby(coordinates: number[], distance: number) {
    const customerLocation = new LocationObject(coordinates, '');
    const restaurants = await this.restaurantModel
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: coordinates,
            },
            $maxDistance: distance,
          },
        },
      })
      .select('restaurant_name avatar location status')
      .populate('cuisine_categories', 'name')
      .exec();

    if (restaurants.length === 0) {
      return [];
    }

    const [distancesAndDurations, avgRatings, campaigns] = await Promise.all([
      this.vietmapService.getMultipleDistanceNDuration(
        restaurants.map((res) => res.location),
        [customerLocation],
        VehicleType.BIKE,
      ),
      this.calculateRestaurantAverageRating(restaurants.map((res) => res.id)),
      this.campaignService.getCampaignsByRestaurantIds(
        restaurants.map((res) => res.id),
      ),
    ]);

    // const [avgRatings, campaigns] = await Promise.all([
    //   this.calculateRestaurantAverageRating(restaurants.map((res) => res.id)),
    //   this.campaignService.getCampaignsByRestaurantIds(
    //     restaurants.map((res) => res.id),
    //   ),
    // ]);

    const restaurantWithCampaigns = new Set(
      campaigns.map((cmp) =>
        cmp.restaurant_id ? cmp.restaurant_id.toString() : null,
      ),
    );

    const combinedRestaurants = restaurants
      .map((res, index) => {
        const review = avgRatings.find((rev) => rev.restaurantId == res.id);
        const { location, ...newRes } = { ...res.toJSON() };
        const hasCmp = restaurantWithCampaigns.has(null)
          ? true
          : restaurantWithCampaigns.has(res.id);
        return {
          ...newRes,
          rating: review ? review.averageRating : 0,
          location: res.location,
          cuisine_categories: res.cuisine_categories.map(
            (cat: any) => cat.name,
          ),
          isClosed: res.status === RestaurantStatus.CLOSED,
          distance: distancesAndDurations[index].elements[0].distance.value,
          duration: distancesAndDurations[index].elements[0].duration.value,
          hasCampaign: hasCmp,
        };
      })
      .filter((res) => res.distance <= distance);

    combinedRestaurants.sort((a, b) => a.distance - b.distance);

    return combinedRestaurants;
  }

  async getRestaurantsByCustomer(
    coordinates: number[],
    page: number = 1,
    limit: number = 10,
    searchQuery: string = '',
    cuisineSlug: string = '',
    sortby: string = 'recommended',
    promo: boolean = false,
    bestOverall: boolean = false,
    under: number = -1,
    deliveryFee: number = -1,
  ) {
    let matchConditions: any = {};
    if (cuisineSlug !== '') {
      const cuisine = await this.cuisineModel.findOne({
        slug: cuisineSlug,
      });
      if (cuisine.id) {
        if (!Types.ObjectId.isValid(cuisine.id)) {
          throw new BadRequestException('Invalid category ID');
        }
        matchConditions.cuisine_categories = new Types.ObjectId(cuisine.id);
      }
    }

    if (searchQuery) {
      matchConditions.$text = {
        $search: this.normalizeString(searchQuery),
      };
    }

    const restaurants = await this.restaurantModel
      .find(matchConditions)
      .select('restaurant_name avatar cuisine_categories location')
      .populate('cuisine_categories', 'name')
      .exec();

    if (restaurants.length == 0)
      return {
        totalPage: 0,
        data: [],
      };

    const restaurantIds = restaurants.map((res) => res.id);
    const locations = restaurants.map((res) => res.location);
    const customerLocation = new LocationObject(coordinates, '');

    const [distancesAndDurations, campaigns, avgRatings] = await Promise.all([
      this.vietmapService.getMultipleDistanceNDuration(
        locations,
        [customerLocation],
        VehicleType.BIKE,
      ),
      this.campaignService.getCampaignsByRestaurantIds(restaurantIds),
      this.calculateRestaurantAverageRating(restaurantIds),
    ]);

    // const [campaigns, avgRatings] = await Promise.all([
    //   this.campaignService.getCampaignsByRestaurantIds(restaurantIds),
    //   this.calculateRestaurantAverageRating(restaurantIds),
    // ]);

    const restaurantWithCampaigns = new Set(
      campaigns.map((cmp) =>
        cmp.restaurant_id ? cmp.restaurant_id.toString() : null,
      ),
    );

    let combinedRestaurants = await Promise.all(
      restaurants.map(async (res, index) => {
        const { location, cuisine_categories, ...newRes } = { ...res.toJSON() };
        const hasCmp = restaurantWithCampaigns.has(null)
          ? true
          : restaurantWithCampaigns.has(res.id);

        const review = avgRatings.find((rev) => rev.restaurantId == res.id);
        return {
          ...newRes,
          cuisine_categories: cuisine_categories.map((cat: any) => cat.name),
          distance: distancesAndDurations[index].elements[0].distance.value,
          duration: distancesAndDurations[index].elements[0].duration.value,
          hasCampaign: hasCmp,
          rating: review ? review.averageRating : 0,
        };
      }),
    );

    if (promo) {
      combinedRestaurants = combinedRestaurants.filter((r) => r.hasCampaign);
    }

    if (bestOverall) {
      combinedRestaurants = combinedRestaurants.filter((r) => r.rating >= 4);
    }

    if (under > -1) {
      combinedRestaurants = combinedRestaurants.filter(
        (r) => r.duration <= under,
      );
    }

    if (deliveryFee > -1) {
      combinedRestaurants = combinedRestaurants.filter(
        (r, index) =>
          this.vietmapService.calculateFare(0, BikeFare) <= deliveryFee,
      );
    }

    switch (sortby) {
      case SortStatus.RECOMMENDED:
        combinedRestaurants.sort((a, b) => a.distance - b.distance);
        break;
      case SortStatus.RATING:
        combinedRestaurants.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    const totalPages = Math.ceil(combinedRestaurants.length / limit);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const dataPage = combinedRestaurants.slice(startIndex, endIndex);

    return {
      currPage: page,
      totalPage: totalPages,
      data: dataPage,
    };
  }

  async getMenu(id: string) {
    const restaurant = await this.findOneById(id);
    const menu = await Promise.all(
      restaurant.restaurant_categories.map(
        async (cate_id) =>
          await this.restaurantCategoryService.getMenuDetails(cate_id),
      ),
    );
    return menu;
  }

  async getInfoByCustomer(id: string, coordinates: number[]) {
    const customerLocation = new LocationObject(coordinates, '');

    const [restaurant, ratingResult] = await Promise.all([
      this.restaurantModel
        .findById(id)
        .select(
          'restaurant_name bio cuisine_categories location cover_image status',
        )
        .populate('cuisine_categories', 'name')
        .lean(),
      this.reviewModel
        .aggregate([
          { $match: { reviewable_id: new Types.ObjectId(id) } },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
            },
          },
        ])
        .exec(),
    ]);

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const { distance, duration } =
      await this.vietmapService.getDistanceNDuration(
        restaurant.location,
        customerLocation,
        VehicleType.BIKE,
      );

    const rating =
      ratingResult.length > 0
        ? Number(ratingResult[0].averageRating.toFixed(1))
        : 0;

    const { cuisine_categories, ...restaurantInfo } = restaurant;

    return {
      ...restaurantInfo,
      cuisine_categories: cuisine_categories.map((cat: any) => cat.name),
      distance: distance,
      duration: duration,
      rating,
    };
  }

  async createCuisineCategory(dto: { name: string; slug: string }) {
    const cuisine = new this.cuisineModel(dto);
    return await cuisine.save();
  }

  async getCuisineCategories() {
    const cuisines = await this.cuisineModel.find();
    return cuisines;
  }

  async getInfo(id: string) {
    const restaurant = await this.findOneById(id);
    const { verified, email, full_name, ...restaurant_info } = (
      restaurant as RestaurantDocument
    ).toJSON();
    return restaurant_info;
  }
}
