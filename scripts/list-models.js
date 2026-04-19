/**
 * 🔍 Dolphin AI Diagnostic Tool
 * यो स्क्रिप्टले तपाइँको API Key ले कुन-कुन मोडेलहरू एक्सेस गर्न सक्छ भनेर देखाउँछ।
 */

const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA3EFr62PEEXaIRpVfW_Qd2tYMu0jftj7Y";
const VERSION = "v1beta"; // सूची हेर्न प्राय: v1beta उत्तम हुन्छ

console.log(`📡 Fetching available models for your API Key...`);

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/${VERSION}/models?key=${API_KEY}`,
    method: 'GET'
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        const json = JSON.parse(body);
        if (json.models) {
            console.log('✅ Available Models:');
            json.models.forEach(m => console.log(` - ${m.name.replace('models/', '')} (${m.supportedGenerationMethods.join(', ')})`));
        } else {
            console.error('❌ Error fetching models:', json);
        }
    });
});

req.on('error', (e) => console.error('❌ Network Error:', e));
req.end();