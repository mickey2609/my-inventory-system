const fs = require('fs');
const path = require('path');

// 匹配所有 trycloudflare.com 網址
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
      // 掃描所有文字類型檔案，包含打包後的 js、map、html 等
      const ext = path.extname(file).toLowerCase();
      if (['.html', '.js', '.map', '.json', '.env', '.css'].includes(ext) || file.startsWith('.env')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (targetDomainRegex.test(content)) {
          console.log(`🧹 發現並修正檔案中的舊網址: ${filePath}`);
          // 將包含  的字串直接刪除（替換為空字串，使 API 自動走同網域相對路徑）
          content = content.replace(targetDomainRegex, '');
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
  }
}

console.log('🔍 開始強制深度掃描所有靜態資源與打包檔...');
scanAndReplace(__dirname);
console.log('✨ 清理完成！請重新提交至 GitHub。');