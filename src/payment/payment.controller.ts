import { Controller, Post, Body, Req, Ip, Get, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from 'src/utils/interfaces';
import { error } from 'console';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('vnpay/create')
  async getVnpayLink(
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @Body() body: { amount: number; orderId: string; returnUrl: string },
  ) {
    try {
      return this.paymentService.createURLVnPay(
        ip,
        body.amount,
        body.orderId,
        body.returnUrl,
      );
    } catch (e) {
      return e;
    }
  }

  @Get('vnpay/return')
  vnPayReturn(@Query() vnpParams: any) {
    const isValidSignature = this.paymentService.verifyReturnUrl(vnpParams);

    if (!isValidSignature) {
      return { error: true, message: 'Invalid signature' };
    }

    const isSuccess = vnpParams['vnp_ResponseCode'] === '00';

    if (isSuccess) {
      this.paymentService.updateBillPaid(vnpParams['vnp_TxnRef']);
    }

    return {
      error: isSuccess ? false : true,
      orderId: vnpParams['vnp_TxnRef'],
      amount: vnpParams['vnp_Amount'] / 100,
      message: isSuccess ? 'Payment successful' : 'Payment failed',
    };
  }

  @Post('refund')
  async getRefundUrl(
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @Body() body: { amount: number; orderId: string; transDate: string },
  ) {
    try {
      return this.paymentService.createRefundUrlVNPay(
        body.orderId,
        body.amount,
        body.transDate,
      );
    } catch (e) {
      return e;
    }
  }
}
