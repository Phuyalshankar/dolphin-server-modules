/**
 * 🚀 Dolphin Real AI Integration Test
 * यो स्क्रिप्टले तपाइँको वास्तविक API Key प्रयोग गरेर 
 * Google Gemini बाट कोड मगाउँछ र 'ai-demo-result.js' मा लेख्छ।
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA3EFr62PEEXaIRpVfW_Qd2tYMu0jftj7Y";
const MODELS = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-pro-latest"];
const VERSIONS = ["v1", "v1beta"];

const payload = JSON.stringify({
    contents: [{ parts: [{ text: `Create a professional Dolphin Server app.
    Context: Simple health check and system info.
    Requirements:
    1. Use ESM 'import' from 'dolphin-server-modules/server'.
    2. Use 'createDolphinServer'.
    3. Routes: GET '/health' (uptime) and GET '/info' (framework name).
    4. Use unified context '(ctx) => ({ ... })'.
    5. Include app.listen(3000).
    Return ONLY the pure JavaScript code, no markdown, no explanations.` 
    }] }]
});

const tryAI = (mIndex, vIndex) => {
    if (mIndex >= MODELS.length) {
        console.error('❌ All models failed. Ensure your API Key from https://aistudio.google.com/ is correct and has access to these models.');
        return;
    }

    if (vIndex >= VERSIONS.length) {
        return tryAI(mIndex + 1, 0);
    }

    const MODEL = MODELS[mIndex];
    const VERSION = VERSIONS[vIndex];
    console.log(`📡 Sending request to Gemini (${MODEL} via ${VERSION})...`);

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/${VERSION}/models/${MODEL}:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            try {
                const json = JSON.parse(body);
                if (json.error) {
                    console.warn(`⚠️ ${MODEL} (${VERSION}) failed: ${json.error.status}`);
                    return tryAI(mIndex, vIndex + 1);
                }
                const rawCode = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (rawCode) {
                    const codeMatch = rawCode.match(/(import|const|let|var|app|function)[\s\S]*/);
                    const code = (codeMatch ? codeMatch[0] : rawCode).replace(/```javascript|```js|```/g, '').trim();
                    fs.writeFileSync(path.join(process.cwd(), 'ai-demo-result.js'), code);
                    console.log(`✅ Success! Code generated using ${MODEL} (${VERSION})`);
                } else {
                    tryAI(mIndex, vIndex + 1);
                }
            } catch (e) {
                tryAI(mIndex, vIndex + 1);
            }
        });
    });

    req.on('error', (e) => tryAI(mIndex, vIndex + 1));
    req.write(payload);
    req.end();
};

tryAI(0, 0);