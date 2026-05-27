import { createDolphinServer } from 'dolphin-server-modules/server';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

const app = createDolphinServer();
connectDB();

app.listen(3000, () => console.log('running'));

