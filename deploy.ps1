# 設置 PowerShell 終端機 UTF-8 編碼
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$headers = @{ "X-Master-Key" = '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm' }

# 1. 向 JSONBin 抓取桌機最新活著的 Tunnel 網址
Write-Host "🔍 正在向 JSONBin 抓取桌機最新網址..." -ForegroundColor Yellow

$url = ""
for ($i = 1; $i -le 8; $i++) {
    try {
        $timestamp = [Math]::Floor((Get-Date -UFormat %s)) + $i
        $res = Invoke-RestMethod -Uri "https://api.jsonbin.io/v3/b/6aad2ed2ac6210605adc4575/latest?t=$timestamp" -Headers $headers -ErrorAction Stop
        $targetUrl = $res.record.url.Trim()

        # 測試該網址是否能連通
        $testConfig = Invoke-RestMethod -Uri "$targetUrl/api/get-global-config" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($testConfig.success) {
            $url = $targetUrl
            Write-Host "✅ 成功取得桌機連線網址：$url" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "⏳ 等候桌機 Tunnel 啟動與上報中，2 秒後重試 ($i/8)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $url) {
    Write-Host "❌ 無法取得桌機連線，請確認桌機 start_tunnel.bat 是否已啟動！" -ForegroundColor Red
    exit
}

# 2. 讀取並推送最新 server.js
$code = [System.IO.File]::ReadAllText("server.js", [System.Text.Encoding]::UTF8)
$payload = @{ code = $code } | ConvertTo-Json -Compress

Write-Host "🚀 正在推送最新 server.js 至桌機地端..." -ForegroundColor Cyan
$updateRes = Invoke-RestMethod -Uri "$url/api/system/update-server-code" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
Write-Host "🎉 地端回傳：$($updateRes.message)" -ForegroundColor Green

# 3. 等候地端業務服務重啟
Write-Host "⏳ 等候桌機業務服務重啟中..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 4. 驗證地端最新版本
Write-Host "🔍 正在驗證地端 API..." -ForegroundColor Yellow
$verified = $false

for ($v = 1; $v -le 5; $v++) {
    try {
        $config = Invoke-RestMethod -Uri "$url/api/get-global-config" -Method Get -ErrorAction Stop
        Write-Host "✅ 遠端部署成功！目前桌機版本：$($config.data.version)" -ForegroundColor Green
        $verified = $true
        break
    } catch {
        Write-Host "⏳ 服務拉起中，2 秒後重試 ($v/5)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $verified) {
    Write-Host "⚠️ 部署完成但驗證回應較慢，請開啟瀏覽器確認。" -ForegroundColor Yellow
}