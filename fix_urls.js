const fs = require('fs');
const path = require('path');

const targetDomainRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g;

function scanAndReplace(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.wrangler') {
        scanAndReplace(filePath);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (['.html', '.js', '.json', '.env', '.config'].includes(ext) || file.startsWith('.env')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (targetDomainRegex.test(content)) {
          console.log(`🧹 發現並清除舊網址: ${filePath}`);
          content = content.replace(targetDomainRegex, '');
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
  }
}

console.log('🔍 開始全域掃描並清理殘留的 trycloudflare 網址...');
scanAndReplace(__dirname);
console.log('✨ 清理完成！請重新提交至 GitHub。');