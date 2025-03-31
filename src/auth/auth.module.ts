import { Module, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerModule } from 'src/customer/customer.module';
import { DriverModule } from 'src/driver/driver.module';
import { JwtModule } from '@nestjs/jwt';
import { RestaurantModule } from 'src/restaurant/restaurant.module';
import { AccessTokenStrategy } from './strategies/accessToken.strategy';
import { RefreshTokenStrategy } from './strategies/refreshToken.strategy';
import { Otp, OtpSchema } from './entities/otp.schema';
import { PaymentModule } from 'src/payment/payment.module';
import { FirebaseModule } from 'src/utils/firebase/firebase.module';
import { Account } from './entities/account.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    JwtModule.register({}),
    CustomerModule,
    DriverModule,
    RestaurantModule,
    PaymentModule,
    FirebaseModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy, RefreshTokenStrategy],
  exports: [AuthService],
})
export class AuthModule {}
