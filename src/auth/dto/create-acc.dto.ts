import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsBoolean, IsNotEmpty, Length, Matches } from 'class-validator';

export class CreateAccountDto {
    @ApiProperty({
        example: "0987654321"
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits' })
    phone: string;

    @ApiProperty({
        example: "phuc@gmail.com"
    })
    @IsEmail({}, { message: 'Invalid email address' })
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: "phuc2002"
    })
    @IsString()
    @Length(6, 20, { message: 'Password must be between 6 and 20 characters' })
    @Matches(/(?=.*[a-zA-Z])(?=.*[0-9])/, { message: 'Password must contain both letters and numbers' })
    password: string;

    @ApiProperty({
        example: "phusc nef"
    })
    @IsString()
    @IsNotEmpty()
    full_name: string;
    // @IsString()
    // @IsNotEmpty()
    // address: string;

    // @IsBoolean()
    // @IsNotEmpty()
    // gender: boolean;
}
