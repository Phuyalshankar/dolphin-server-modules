import { collection } from '../utils/database.js';
import { Order } from '../models/Order.js';
export class OrderController {
  async getAllOrders() {
    const orders = await collection.find().toArray();
    return orders;
  }

  async createOrder(order) {
    await collection.insertOne(order);
    return order;
  }
}