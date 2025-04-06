import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsObject, IsString, min } from 'class-validator';
import { FoodItem } from '../entities/food_item.schema';
import { ModifierGroup } from '../entities/modifier_groups.schema';
import { Modifier } from '../entities/modifier.schema';

export class RestaurantCategoryDto {
  _id?: string;

  @ApiProperty({
    examples: ['Ăn sáng', 'Ăn trưa', 'Ăn tối', 'Ăn vặt', 'Đồ uống'],
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'say oh yeahhhhhh!!!',
  })
  @IsString()
  bio: string;

  @ApiProperty({})
  @IsArray()
  food_items: FoodItem[];
}
