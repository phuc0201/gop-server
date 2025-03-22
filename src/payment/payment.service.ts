import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { format } from 'date-fns';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BillStatus, OrderType, PaymentMethod } from 'src/utils/enums';
import { Bill, BillDocument } from './entities/bill.schema';
import { Ledger, LedgerDocument } from './entities/ledger.schema';
import { DeliveryOrder } from 'src/order/entities/delivery_order.schema';
import { TransportOrder } from 'src/order/entities/transport_order.schema';
import { Order, OrderDetailsType } from 'src/order/entities/order.schema';
import { CreateBillDto } from './dto/create-bill.dto';
import { ApplyCampaignDto } from './dto/apply-campaign.dto';
import { CampaignService } from 'src/campaign/campaign.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly vnpUrl: string;
  private readonly tmnCode: string;
  private readonly hashSecret: string;

  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Ledger.name) private readonly ledgerModel: Model<Ledger>,
    private readonly campaignService: CampaignService,
    private configService: ConfigService,
  ) {
    this.vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    this.tmnCode = this.configService.get<string>('VNPAY_TMN_CODE');
    this.hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');
  }

  createURLVnPay(ip: string, amount: number, billId: string, url: string) {
    const date = new Date();
    let tmnCode = this.tmnCode;
    let secretKey = this.hashSecret;
    let vnpUrl = this.vnpUrl;
    let returnUrl = url;
    let locale = 'vn';
    let currCode = 'VND';
    let vnp_Params = {};

    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = billId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD: ' + billId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ip;
    vnp_Params['vnp_CreateDate'] = format(date, 'yyyyMMddHHmmss');
    vnp_Params['vnp_BankCode'] = 'NCB';

    vnp_Params = this.sortObject(vnp_Params);

    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac('sha512', secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    return vnpUrl;
  }

  createRefundUrlVNPay(orderId: string, amount: number, transDate: string) {
    const date = new Date();
    let secretKey = 'DGCULOB4IRXO70APD55EP36RID3LL2LJ';
    let vnp_ApiUrl =
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    const vnp_Params = {};

    (vnp_Params['vnp_Version'] = '2.1.0'),
      (vnp_Params['vnp_Command'] = 'refund'),
      (vnp_Params['vnp_TmnCode'] = '0NDLY2ZY'),
      (vnp_Params['vnp_TxnRef'] = orderId),
      (vnp_Params['vnp_Amount'] = amount * 100),
      (vnp_Params['vnp_TransDate'] = transDate),
      (vnp_Params['vnp_CreateDate'] = format(date, 'yyyyMMddHHmmss')),
      (vnp_Params['vnp_SecureHashType'] = 'SHA256');
    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac('sha512', secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;
    const querystring = new URLSearchParams(vnp_Params).toString();
    return `${vnp_ApiUrl}?${querystring}`;
  }

  verifyReturnUrl(vnpParams: any): boolean {
    const secureHash = vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
  }

  async quoteBill(createBillDto: CreateBillDto) {
    const initStatus = BillStatus.PROGRESSING;
    const new_bill = new this.billModel({
      order: createBillDto.order,
      status: initStatus,
      payment_method: createBillDto.payment_method,
    });

    let campaignDto: ApplyCampaignDto = {
      compaign_ids: createBillDto.campaign_id,
      subtotal: 0,
      delivery_fare: 0,
    };
    if (createBillDto.order.order_type === OrderType.DELIVERY) {
      const order = createBillDto.order as DeliveryOrder;
      new_bill.sub_total = order.order_cost + order.delivery_fare;
      campaignDto.delivery_fare = order.delivery_fare;
      campaignDto.subtotal = order.order_cost;
    } else {
      const order = createBillDto.order as TransportOrder;
      new_bill.sub_total = order.trip_fare;
      campaignDto.subtotal = order.trip_fare;
    }

    let discount = await this.campaignService.validateAndApplyCampaign(
      createBillDto.order.customer._id,
      campaignDto,
      true,
    );

    new_bill.discount = discount;
    new_bill.total = new_bill.sub_total - discount + new_bill.platform_fee;
    return new_bill;
  }

  async createBill(createBillDto: CreateBillDto) {
    const initStatus = BillStatus.PROGRESSING;
    const new_bill = new this.billModel({
      order: createBillDto.order,
      status: initStatus,
      payment_method: createBillDto.payment_method,
      campaign_id: createBillDto.campaign_id,
    });

    let campaignDto: ApplyCampaignDto = {
      compaign_ids: createBillDto.campaign_id,
      subtotal: 0,
      delivery_fare: 0,
    };
    if (createBillDto.order.order_type === OrderType.DELIVERY) {
      const order = createBillDto.order as DeliveryOrder;
      new_bill.sub_total = order.order_cost + order.delivery_fare;
      campaignDto.delivery_fare = order.delivery_fare;
      campaignDto.subtotal = order.order_cost;
    } else {
      const order = createBillDto.order as TransportOrder;
      new_bill.sub_total = order.trip_fare;
      campaignDto.subtotal = order.trip_fare;
    }

    let discount = await this.campaignService.validateAndApplyCampaign(
      createBillDto.order.customer._id,
      campaignDto,
    );
    new_bill.discount = discount;
    new_bill.total = new_bill.sub_total - discount + new_bill.platform_fee;

    return (await new_bill.save()).toJSON();
  }

  async getBillsByIds(billIds: string[]): Promise<BillDocument[]> {
    return await this.billModel.find({ _id: { $in: billIds } }).exec();
  }

  async updateBillCancel(order: OrderDetailsType) {
    await this.billModel
      .findOneAndUpdate(order.bill, { status: BillStatus.CANCELLED })
      .exec();
  }

  async updateBillPaid(billId: string) {
    return await this.billModel.findByIdAndUpdate(billId, {
      status: BillStatus.PAID,
    });
  }

  async getBill(id: string): Promise<BillDocument> {
    return await this.billModel.findById(id).exec();
  }

  async updateBillComplete(order: OrderDetailsType) {
    const bill = await this.billModel.findOne(order.bill).exec();

    bill.status = BillStatus.COMPLETED;

    if (order instanceof DeliveryOrder) {
      if (bill.payment_method === PaymentMethod.VNPAY) {
        // cập nhật ledger cho restaurant và driver với 90% lợi nhuận
        this.updateLedger(order.restaurant._id, order, order.order_cost * 0.9);
        this.updateLedger(order.driver._id, order, order.delivery_fare * 0.9);
      } else if (bill.payment_method === PaymentMethod.COD) {
        // cập nhật ledgers cho restaurant và drivers trả 10% lợi nhận cho nền tảng
        this.updateLedger(order.restaurant._id, order, order.order_cost * -0.1);
        this.updateLedger(order.driver._id, order, order.delivery_fare * 0.9);
      }
    } else if (order instanceof TransportOrder) {
      if (bill.payment_method === PaymentMethod.VNPAY) {
        // cập nhật ledgers cho drivers với 90% lợi nhuận
        this.updateLedger(order.driver._id, order, order.trip_fare * 0.9);
      } else if (bill.payment_method === PaymentMethod.COD) {
        // cập nhật ledgers cho drivers trả 10% lợi nhuận cho nền tảng
        this.updateLedger(
          order.driver._id,
          order,
          order.trip_fare * 0.9 - bill.total,
        );
      }
    }

    return (await bill.save()).toObject();
  }

  async getLedger(owner_id: string): Promise<LedgerDocument> {
    const ledger_exist = await this.ledgerModel.findOne({
      owner_id: owner_id,
      closed: false,
    });
    if (ledger_exist) {
      return ledger_exist;
    }

    return (
      await new this.ledgerModel({
        owner_id: owner_id,
      }).save()
    ).toObject();
  }

  async closeLedger(owner_id: string): Promise<LedgerDocument> {
    const ledger = await this.getLedger(owner_id);

    ledger.closed = true;

    return (await ledger.save()).toObject();
  }

  async updateLedger(owner_id: string, order: Order, amount: number) {
    const ledger = await this.getLedger(owner_id);

    ledger.orders.push(order);
    ledger.total += amount;

    await ledger.save();
  }
}
