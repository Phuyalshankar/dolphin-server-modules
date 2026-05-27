const fs = require('fs');

const mdContent = fs.readFileSync('DOLPHIN_MASTER_GUIDE_NEPALI.md', 'utf8');

const escapedMd = mdContent
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$')
  .replace(/<\/script>/gi, '<\\/script>');

const cssContent = fs.readFileSync('style.css', 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dolphin Framework Master Guide</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        ${cssContent}
        body { padding: 45px; max-width: 900px; margin: 0 auto; box-sizing: border-box; }
        @media (max-width: 767px) { body { padding: 15px; } }
    </style>
</head>
<body>
    <div id="content"></div>
    <script>
        const rawMd = \`${escapedMd}\`;
        document.getElementById('content').innerHTML = marked.parse(rawMd);
    </script>
</body>
</html>`;

fs.writeFileSync('guide.html', html);
console.log('guide.html generated successfully.');
