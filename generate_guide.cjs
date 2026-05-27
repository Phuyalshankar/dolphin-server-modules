const fs = require('fs');

const mdContent = fs.readFileSync('DOLPHIN_MASTER_GUIDE_NEPALI.md', 'utf8');

// Escape backticks and dollar signs for template literals
const escapedMd = mdContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dolphin Framework Master Guide</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; }
        @media (max-width: 767px) { body { padding: 15px; } }
    </style>
</head>
<body>
    <article class="markdown-body" id="content"></article>
    <script>
        const rawMd = \`${escapedMd}\`;
        document.getElementById('content').innerHTML = marked.parse(rawMd);
    </script>
</body>
</html>`;

fs.writeFileSync('guide.html', html);
console.log('guide.html generated successfully.');
