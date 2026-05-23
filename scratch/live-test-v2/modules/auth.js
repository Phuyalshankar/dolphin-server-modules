import { Module } from 'dolphin-server-modules';
import express from 'express';
import jwt from 'jsonwebtoken';
const authModule = new Module('auth');
authModule.setRouter(express.Router());
authModule.getRouter().post('/login', (req, res) => {
  const token = jwt.sign({ userId: 1 }, 'secretKey', { expiresIn: '1h' });
  res.json({ token });
});
export default authModule;