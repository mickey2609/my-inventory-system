# 設置 PowerShell 終端機 UTF-8 編碼
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
\$OutputEncoding = [System.Text.Encoding]::UTF8

\$headers = @{
    "X-Master-Key" = '\$2a\$10\$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm'
    "X-Bin-Meta"   = "false"
    "User-Agent"   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# 1. 向 JSONBin 抓取桌機最新活著的 Tunnel 網址
Write-Host "🔍 正在向 JSONBin 抓取桌機最新網址..." -ForegroundColor Yellow

\$url = ""
for (\$i = 1; $i -le 10; $i++) {
    try {
        \$timestamp = [Math]::Floor((Get-Date -UFormat %s)) + $i$res = Invoke-RestMethod -Uri "https://api.jsonbin.io/v3/b/6aad2ed2ac6210605adc4575/latest?t=$timestamp" -Headers $headers -TimeoutSec 10 -ErrorAction Stop
        $targetUrl = if ($res.record) { $res.record.url } else {$res.url }
        $targetUrl =$targetUrl.Trim().TrimEnd('/')

        Write-Host "🌐 嘗試連線至：\$targetUrl" -ForegroundColor DarkGray
        $testConfig = Invoke-RestMethod -Uri "$targetUrl/api/get-global-config" -Method Get -TimeoutSec 10 -ErrorAction Stop
        if (\$testConfig.success -or $testConfig.data -or$testConfig) {
            $url =$targetUrl
            Write-Host "✅ 成功取得桌機連線網址：\$url" -ForegroundColor Green
            break
        }
    } catch {
        $detail =$_.Exception.Message
        if ($_.ErrorDetails -and$_.ErrorDetails.Message) {
            $detail = "$detail | $($_.ErrorDetails.Message)"
        }
        Write-Host "⏳ 重試 ($i/10) 失敗原因：$detail" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not \$url) {
    Write-Host "❌ 無法取得桌機連線，請確認桌機 start_tunnel.bat 是否已啟動！" -ForegroundColor Red
    exit
}

# 2. 先推送 routes 資料夾下所有檔案
if (Test-Path "routes") {
    \$routeFiles = Get-ChildItem -Path "routes" -Filter "*.js"
    foreach (\$file in $routeFiles) {$relPath = "routes/$($file.Name)"
        \$routeCode = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)$routePayload = @{ filename = $relPath; code =$routeCode } | ConvertTo-Json -Compress
        
        Write-Host "🚀 正在推送 \$relPath 至桌機..." -ForegroundColor Cyan
        try {
            $rRes = Invoke-RestMethod -Uri "$url/api/system/update-server-code" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes(\$routePayload)) -TimeoutSec 15
            Write-Host "🎉 地端回傳：$($rRes.message)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ 推送 \$rel