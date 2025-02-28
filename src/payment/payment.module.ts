import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Bill, BillSchema } from './entities/bill.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Ledger, LedgerSchema } from './entities/ledger.schema';
import {
  RevenueHistory,
  RevenueHistorySchema,
} from './entities/revenue_history.schem';
import { CampaignModule } from 'src/campaign/campaign.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Ledger.name, schema: LedgerSchema },
      { name: RevenueHistory.name, schema: RevenueHistorySchema },
    ]),
    CampaignModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
