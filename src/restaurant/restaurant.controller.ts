import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/utils/guards/roles.guard';
import { Roles } from 'src/utils/decorators/roles.decorator';
import { RestaurantStatus, RoleType } from 'src/utils/enums';
import { RequestWithUser } from 'src/utils/interfaces';
import { CreateRestaurantCategoryDto } from './dto/create-restaurant-category.dto';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { UpdateRestaurantCategoryDto } from './dto/update-restaurant-category.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { PaymentService } from 'src/payment/payment.service';
import { ReviewDto } from './dto/review.dto';
import { GetRestaurantsQueryDto } from './dto/get-restaurant-query.dto';
import { CampaignService } from 'src/campaign/campaign.service';
import { ConfigService } from '@nestjs/config';

@ApiBearerAuth()
@ApiTags('Restaurants')
@Controller('restaurant')
export class RestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly campainService: CampaignService,
    private readonly configService: ConfigService,
  ) {}

  @Post('create')
  async createMenus(
    @Body() body: { restaurant_id: string; restaurantIdOnBe: string },
  ) {
    try {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      myHeaders.append(
        'Authorization',
        this.configService.get<string>('BEFOOD_TOKEN'),
      );
      const raw = JSON.stringify({
        restaurant_id: body.restaurantIdOnBe,
        locale: 'vi',
        app_version: '11269',
        version: '1.1.269',
        device_type: 3,
        operator_token: '0b28e008bc323838f5ec84f718ef11e6',
        customer_package_name: 'xyz.be.food',
        device_token: '99d149899c4f2f3d79df1f8e73f539ef',
        ad_id: '',
        screen_width: 360,
        screen_height: 640,
        client_info: {
          locale: 'vi',
          app_version: '11269',
          version: '1.1.269',
          device_type: 3,
          operator_token: '0b28e008bc323838f5ec84f718ef11e6',
          customer_package_name: 'xyz.be.food',
          device_token: '99d149899c4f2f3d79df1f8e73f539ef',
          ad_id: '',
          screen_width: 360,
          screen_height: 640,
        },
        latitude: 10.84992,
        longitude: 106.77172,
      });

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow' as RequestRedirect,
      };

      const response = await fetch(
        'https://gw.be.com.vn/api/v1/be-marketplace/web/restaurant/detail',
        requestOptions,
      );

      const result = await response.json();

      const dto = result.data.categories.map((category) => {
        return {
          name: category.category_name,
          food_items: category.items.map((item) => {
            return {
              image: item.item_image_compressed_web,
              price: item.price,
              name: item.item_name,
              bio: item.item_details,
              modifier_groups: item.customize_item.map((customize) => {
                return {
                  name: customize.customize_item_name,
                  min: customize.customize_item_lower_limit,
                  max: customize.customize_item_limit,
                  modifier: customize.customize_options.map((modifier) => {
                    return {
                      name: modifier.customize_option_name,
                      price: modifier.customize_price,
                    };
                  }),
                };
              }),
            };
          }),
        };
      });

      return this.restaurantService.createMenus(body.restaurant_id, dto);
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Get('cuisine-categories')
  fetchCuisineCategories() {
    try {
      const cuisines = this.restaurantService.getCuisineCategories();
      return cuisines;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Post('cuisine-category')
  createCuisineCategory(@Body() body: { name: string; slug: string }) {
    try {
      const cuisine = this.restaurantService.createCuisineCategory(body);
      return cuisine;
    } catch (error) {
      throw new Error(error);
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.CUSTOMER)
  @Post('review')
  async createRestaurantReview(@Body() body: ReviewDto) {
    try {
      return await this.restaurantService.createReview(body);
    } catch (error) {
      throw new Error('create review failed');
    }
  }

  @Get(':id/reviews')
  async findReviewsByResId(@Param('id') id: string) {
    try {
      const reviews = await this.restaurantService.getReivewsByRes(id);
      return reviews;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('info')
  fetchInfoByCustomer(@Query() query: { coordinates: string; id: string }) {
    const coordinates = query.coordinates.split(',').map(Number);
    return this.restaurantService.getInfoByCustomer(query.id, coordinates);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Get('info')
  fetchInfo(@Req() req: RequestWithUser) {
    return this.restaurantService.getInfo(req.user.sub);
  }

  @Get('menu/:id')
  async fetchMenu(@Param('id') id?: string) {
    return await this.restaurantService.getMenu(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Get('menu')
  async fetchMenuByRes(@Req() req: RequestWithUser) {
    return await this.restaurantService.getMenu(req.user.sub);
  }

  @Get('nearby')
  async findRestaurantsNearby(
    @Query() query: { coordinates: string; distance: number },
  ) {
    try {
      const coordinates = query.coordinates.split(',').map(Number);
      const result = await this.restaurantService.findRestaurantsNearby(
        coordinates,
        query.distance,
      );

      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Get('recommended')
  async getRestaurants(@Query() query: GetRestaurantsQueryDto) {
    const {
      coordinates,
      page,
      limit,
      searchQuery,
      cuisineSlug,
      sortby,
      promo,
      bestOverall,
      under,
      deliveryFee,
    } = query;
    const parsedCoordinates = coordinates.split(',').map(Number);
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const parsedPromo = promo === 'true';
    const parsedBestOverall = bestOverall === 'true';
    const parsedUnder = isNaN(parseInt(under, 10)) ? -1 : parseInt(under, 10);
    const parsedDeliveryFee = isNaN(parseInt(deliveryFee, 10))
      ? -1
      : parseInt(deliveryFee, 10);

    const res = await this.restaurantService.getRestaurantsByCustomer(
      parsedCoordinates,
      parsedPage,
      parsedLimit,
      searchQuery,
      cuisineSlug,
      sortby,
      parsedPromo,
      parsedBestOverall,
      parsedUnder,
      parsedDeliveryFee,
    );

    return res;
  }

  getProfile(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  updateProfile(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  createMenu(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  updateMenu(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  deleteMenu(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  createPromotion(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  updatePromotion(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  deletePromotion(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Get('profile')
  getProile(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Patch('info/update')
  async updateRestaurant(
    @Req() req: RequestWithUser,
    @Body() body: UpdateRestaurantDto,
  ): Promise<any> {
    try {
      const restaurant = await this.restaurantService.updateRestaurant(
        req.user.sub,
        body,
      );
      return restaurant;
    } catch (error) {
      return error;
    }
  }

  @Roles(RoleType.RESTAURANT)
  @Post('order/:id/accept')
  acceptOrder(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Roles(RoleType.RESTAURANT)
  @Post('order/:id/reject')
  rejectOrder(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Roles(RoleType.RESTAURANT)
  @Post('order/:id/details')
  getOrderDetails(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Roles(RoleType.RESTAURANT)
  @Get('orders')
  getOrders(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Roles(RoleType.RESTAURANT)
  @Delete('order/:id/delete')
  deleteOrder(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @Roles(RoleType.RESTAURANT)
  @Get('/statistics/revenue')
  getRevenueStatistics(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Get('category')
  fetchCategory(@Req() req: RequestWithUser) {
    return this.restaurantService.findCategoryByRestaurant(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Post('category/create')
  async createCategory(
    @Req() req: RequestWithUser,
    @Body() body: CreateRestaurantCategoryDto,
  ): Promise<any> {
    try {
      const restaurant = await this.restaurantService.addCategory(
        req.user.sub,
        body,
      );
      return restaurant;
    } catch (error) {
      return error;
    }
  }

  @Roles(RoleType.RESTAURANT)
  @Post('category/:id/update-image')
  @UseInterceptors(FileInterceptor('image'))
  updateCategoryImage(
    @Param('id') cate_id: string,
    @UploadedFile() image: Express.Multer.File,
  ) {
    const uploadImage = this.restaurantService.updateCategoryImg(
      cate_id,
      image,
    );
    return uploadImage;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Patch('category/:id/update')
  async updateCategory(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateRestaurantCategoryDto,
  ): Promise<any> {
    try {
      const restaurant = await this.restaurantService.updateCategory(
        req.user.sub,
        id,
        body,
      );
      return restaurant;
    } catch (error) {
      return error;
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Delete('category/:id/delete')
  async deleteCategory(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<any> {
    try {
      const category = await this.restaurantService.deleteCategory(
        id,
        req.user.sub,
      );
      return category;
    } catch (error) {
      return error;
    }
  }

  @Get('fooditem/:id')
  async fetchFoodDetails(@Param('id') id: string) {
    const foodItem = await this.restaurantService.getFooditemDetails(id);
    return foodItem;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Post('fooditem/create')
  async createFoodItem(
    @Req() req: RequestWithUser,
    @Body() body: CreateFoodItemDto,
  ): Promise<any> {
    try {
      const foodItem = await this.restaurantService.createFoodItem(
        req.user.sub,
        body,
      );
      return foodItem;
    } catch (error) {
      return error;
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Patch('fooditem/update')
  async updateFoodItem(@Body() body: UpdateFoodItemDto): Promise<any> {
    return await this.restaurantService.updateFoodItem(body);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Post('fooditem/:id/update-image')
  @UseInterceptors(FileInterceptor('image'))
  updateFoodItemImage(
    @Param('id') food_item_id: string,
    @UploadedFile() image: Express.Multer.File,
  ) {
    const uploadImage = this.restaurantService.updateFoodItemImg(
      food_item_id,
      image,
    );
    return uploadImage;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Post('fooditem/delete')
  async deleteFoodItem(
    @Req() req: RequestWithUser,
    @Body() body: { category_id: string; foodItem_id: string },
  ): Promise<any> {
    try {
      const foodItems = await this.restaurantService.deleteFoodItem(
        req.user.sub,
        body.category_id,
        body.foodItem_id,
      );
      return foodItems;
    } catch (error) {
      throw new Error('Delete fooditem failed');
    }
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image'))
  updateAvatar(@UploadedFile() image: Express.Multer.File) {
    try {
      if (!image) {
        throw new BadRequestException('file is required');
      }
      return this.restaurantService.updateFoodItemImg(
        '6647a4011216ae8cfd4a9c21',
        image,
      );
    } catch (error) {
      return error;
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Get('campaigns')
  async getCampaigns(@Req() req: RequestWithUser): Promise<any> {
    return await this.campainService.getCampaignByRestaurantId(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.CUSTOMER)
  @Get(':id/campaigns')
  async getCampaignsByCustomer(@Param() query: { id: string }): Promise<any> {
    return await this.campainService.getCampaignByRestaurantId(query.id);
  }

  // @Roles(RoleType.RESTAURANT)
  // @Get(':id/campaigns')
  // async getCampaignsByOwnerId(@Param('id') id: string): Promise<any> {
  //   return await this.paymentService.getCampaignByOwnerId(id);
  // }

  // @Roles(RoleType.RESTAURANT)
  // @Get('campaign/:id')
  // getCampaignDetails(): Promise<any> {
  //   throw new Error('Method not implemented.');
  // }

  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles(RoleType.RESTAURANT)
  // @Post('campaign/create')
  // async createCampaign(@Body() body: CreateCampaignDto): Promise<any> {
  //   return await this.paymentService.createCampaign(body);
  // }

  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles(RoleType.RESTAURANT)
  // @Patch('campaign/update')
  // async updateCampaign(@Body() body: UpdateCampaignnDto): Promise<any> {
  //   try {
  //     return await this.paymentService.updateCampaign(body);
  //   } catch (error) {
  //     throw new Error('Update campaign failed!')
  //   }
  // }

  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles(RoleType.RESTAURANT)
  // @Delete('campaign/:id/delete')
  // async deleteCampaign(@Param('id') id: string, @Req() req: RequestWithUser): Promise<any> {
  //   try {
  //     return await this.paymentService.deleteCampaign(id, req.user.sub)
  //   } catch (error) {
  //     throw new Error('Delete campaign failed')
  //   }
  // }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleType.RESTAURANT)
  @Patch('status')
  updateActiveStatus(
    @Req() req: RequestWithUser,
    @Body() body: { status: RestaurantStatus },
  ) {
    return this.restaurantService.updateActiveStatus(req.user.sub, body.status);
  }
}
