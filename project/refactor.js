const fs = require('fs');

const files = [
    'Alerts.html', 'analytics.html', 'map.html', 
    'monitor.html', 'trends.html', 'ai.html', 
    'report.html', 'settings.html'
];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf-8');
        
        // Remove .sidebar and its contents
        content = content.replace(/<div class="sidebar"[\s\S]*?<\/div>\s*(?=<!-- MAIN|<div class="main|<div class="header|<h1)/, '');
        
        // Ensure Outfit font is in <head>
        if(!content.includes('Outfit')) {
            content = content.replace(/<head>/, `<head>\n<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">\n<style>\n* { font-family: 'Outfit', sans-serif !important; }\n</style>`);
        }

        // Make body background transparent to blend with iframe
        content = content.replace(/body\s*\{[\s\S]*?\}/, `body {\n  background: transparent !important;\n  color: #e2e8f0 !important;\n  padding: 20px;\n  overflow-y: auto;\n}`);
        
        // Transform some of the cards to use glass UI style if they exist
        content = content.replace(/\.card\s*\{[\s\S]*?\}/, `.card {\n  background: rgba(255, 255, 255, 0.03) !important;\n  backdrop-filter: blur(15px) !important;\n  -webkit-backdrop-filter: blur(15px) !important;\n  border: 1px solid rgba(255, 255, 255, 0.05) !important;\n  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3) !important;\n  border-radius: 20px;\n  padding: 24px;\n}`);

        // Custom scrollbar
        const scrollbar = `
<style>
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
</style>
`;
        if(!content.includes('::-webkit-scrollbar')) {
            content = content.replace(/<\/head>/, `${scrollbar}\n</head>`);
        }

        // Remove back buttons (since navigation is handled by shell)
        content = content.replace(/<button onclick="goBack.*?Dashboard.*?<\/button>/, '');
        
        fs.writeFileSync(file, content);
        console.log(`Refactored ${file}`);
    } catch(e) {
        console.error(`Error with ${file}:`, e);
    }
});
