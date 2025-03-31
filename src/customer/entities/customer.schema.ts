import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Account } from 'src/auth/entities/account.schema';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema()
export class Customer extends Account {
  @Prop({ default: '' })
  address: string;

  @Prop({ default: true })
  gender: boolean; //* male: true

  @Prop({ default: '' })
  avatar: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
