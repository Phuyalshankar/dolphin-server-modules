import { Module } from 'dolphin-server-modules';
import express from 'express';
import { MongoClient } from 'mongodb';
const orderModule = new Module('orders');
const client = new MongoClient('mongodb://localhost:27017');
const db = client.db();
const collection = db.collection('orders');
orderModule.setRouter(express.Router());
orderModule.getRouter().get('/', async (req, res) => {
  const orders = await collection.find().toArray();
  res.json(orders);
});
orderModule.getRouter().post('/', async (req, res) => {
  const order = req.body;
  await collection.insertOne(order);
  res.json(order);
});
export default orderModule;