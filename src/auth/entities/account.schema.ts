import { Prop } from "@nestjs/mongoose";
import { BaseEntity } from "src/utils/repository/base.entity";


export class Account extends BaseEntity{
    @Prop({ unique: true, sparse: true, required: true })
    phone: string

    @Prop({ required: true, unique: true })
    email: string

    @Prop({ required: true })
    password: string

    @Prop({ required: true })
    full_name: string

    @Prop()
    refresh_token?: string

    @Prop({ default: true })
    verified: boolean

    @Prop({ default: 0 })
    balance: number
}

