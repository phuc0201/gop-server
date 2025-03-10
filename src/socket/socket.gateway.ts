import { Logger, Req, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { NestGateway } from '@nestjs/websockets/interfaces/nest-gateway.interface';
import { CustomerService } from 'src/customer/customer.service';
import { DriverService } from 'src/driver/driver.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Server, Socket } from 'socket.io';
import { OrderStatus } from 'src/utils/enums';
@WebSocketGateway({
  namespace: 'api/v1/socket',
  cors: { origin: '*' },
})
export class SocketGateway implements NestGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly driverService: DriverService,
    private readonly restaurantService: RestaurantService,
    private readonly customerService: CustomerService,
  ) {}
  private logger = new Logger('SocketGateway');

  afterInit(server: Server) {
    console.log('Socket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected with id: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log('Client disconnected');
  }

  notifyOrderState(orderId: string, order_status: OrderStatus) {
    const msg = {
      orderId: orderId,
      order_status: order_status,
    };
    this.server.emit(`order.${orderId}`, msg);
  }

  @SubscribeMessage('notify')
  notifyToCustomer(@MessageBody() msg: any) {
    this.server.emit('notify', msg);
  }
}
