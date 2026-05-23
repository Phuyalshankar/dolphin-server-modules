import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/api/hello', (ctx) => {
  return { message: 'Hello from Dolphin!' };
});

console.log('✅ सर्भर पोर्ट ४००० मा चलिरहेको छ!');

app.listen(4000, () => {
  console.log('सर्भर ४००० मा चलिरहेको छ');
});