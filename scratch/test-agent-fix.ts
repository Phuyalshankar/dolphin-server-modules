import { DolphinAgent } from '../src/ai/dolphin-agent/agent.js';
import fs from 'fs/promises';
import path from 'path';

async function test() {
    const agent = new DolphinAgent({
        framework: 'dolphin',
        apiKey: process.env.GROQ_API_KEY || 'test'
    });

    const testPath = 'real-test/nested/folder/test.js';
    const testContent = 'console.log("Success");';

    console.log(`Testing recursive write for: ${testPath}`);
    
    // Simulate what the agent does in 'write' tool
    const wPath = path.resolve(process.cwd(), testPath);
    await fs.mkdir(path.dirname(wPath), { recursive: true });
    await fs.writeFile(wPath, testContent);

    console.log('✅ File created successfully!');
    
    // Check if it exists
    const exists = await fs.stat(wPath).then(() => true).catch(() => false);
    console.log(`Exists: ${exists}`);
}

test().catch(console.error);
