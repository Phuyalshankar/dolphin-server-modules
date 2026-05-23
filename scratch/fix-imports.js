import fs from 'fs';
import path from 'path';

function walk(dir) {
    let files = fs.readdirSync(dir);
    files.forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') walk(fullPath);
        } else if (file.endsWith('.ts')) {
            fixFile(fullPath);
        }
    });
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Match: from './foo' or from "../bar"
    // Don't match if it has an extension (contains a dot in the filename part)
    let fixed = content.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
        if (p2.includes('.js') || p2.includes('.json') || p2.includes('.css')) return match;
        // If it ends with a slash or is just . or ..
        if (p2.endsWith('/') || p2 === '.' || p2 === '..') return match;
        
        return `${p1}${p2}.js${p3}`;
    });
    
    if (content !== fixed) {
        fs.writeFileSync(filePath, fixed);
        console.log(`✅ Fixed: ${filePath}`);
    }
}

walk('./src');
console.log('Done!');
