/**
 * 🤖 Dolphin AI Logic Test
 * यो स्क्रिप्टले AI बाट आएको कच्चा (raw) रेस्पोन्सलाई 
 * हाम्रो CLI ले कसरी सफा कोडमा बदल्छ भनेर जाँच्छ।
 */

const fs = require('fs');
const path = require('path');

// Mock AI Response with Markdown backticks
const mockAiResponse = "```javascript\nconst { createDolphinServer } = require('dolphin-server-modules/server');\nconst app = createDolphinServer();\napp.get('/', (ctx) => ({ message: 'AI Works!' }));\napp.listen(3000);\n```";

function simulateParsing(rawText) {
    // CLI.ts मा भएको रिप्लेस लजिक
    return rawText.replace(/```javascript|```/g, '').trim();
}

function runTest() {
    console.log('🧪 Running AI Logic Test...');

    const cleanedCode = simulateParsing(mockAiResponse);

    console.log('\n--- Cleaned Code Output ---');
    console.log(cleanedCode);
    console.log('---------------------------\n');

    if (cleanedCode.includes('```') || cleanedCode.includes('javascript')) {
        console.error('❌ FAIL: Markdown backticks are still present!');
        process.exit(1);
    }

    if (!cleanedCode.includes('createDolphinServer')) {
        console.error('❌ FAIL: Core code logic missing!');
        process.exit(1);
    }

    console.log('✅ PASS: AI Response parsing logic is correct.');
    
    // Test file creation
    fs.writeFileSync(path.join(process.cwd(), 'ai-test-output.js'), cleanedCode);
    console.log('✅ PASS: Simulated file written to ai-test-output.js');
}

runTest();