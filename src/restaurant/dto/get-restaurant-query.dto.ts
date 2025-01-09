import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';

export class GetRestaurantsQueryDto {
  coordinates: string; // Toạ độ địa lý (longitude, latitude)

  @IsOptional()
  @IsString()
  searchQuery?: string;

  cuisineId?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  sortby?: string;
  promo?: string;
  under?: string;
  bestOverall?: string;
  deliveryFee?: string;
}
