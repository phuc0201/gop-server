import { ApiProperty, OmitType } from "@nestjs/swagger";
import { CreateAccountDto } from "./create-acc.dto";
import { IsString, Length } from "class-validator";

export class SigninDto{
    @ApiProperty({
        example: "phuc@gmail.com"
    })
    email: string

    @ApiProperty({
        example: "phuc02012002"
    })
    @IsString()
    @Length(6, 20, { message: 'Password must be between 6 and 20 characters' })
    password: string
}