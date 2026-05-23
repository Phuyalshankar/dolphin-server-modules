const https = require('https');
const key = 'AIzaSyDeHXvLm0SujoSnGemGsQO2HoB6piM9ndE';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
    });
}).on('error', console.error);
