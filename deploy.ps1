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

# 2. 先推送 routes 資料夾下所有檔案
if (Test-Path "routes") {
    $routeFiles = Get-ChildItem -Path "routes" -Filter "*.js"
    foreach ($file in $routeFiles) {
        $relPath = "routes/$($file.Name)"
        $routeCode = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $routePayload = @{ filename = $relPath; code = $routeCode } | ConvertTo-Json -Compress
        
        Write-Host "🚀 正在推送 $relPath 至桌機..." -ForegroundColor Cyan
        try {
            $rRes = Invoke-RestMethod -Uri "$url/api/system/update-server-code" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($routePayload))
            Write-Host "🎉 地端回傳：$($rRes.message)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ 推送 $relPath 失敗：$($_.Exception.Message)" -ForegroundColor Red
        }
        Start-Sleep -Seconds 1
    }
}

# 3. 最後推送 server.js（觸發主程式重啟）
$code = [System.IO.File]::ReadAllText("server.js", [System.Text.Encoding]::UTF8)
$payload = @{ filename = "server.js"; code = $code } | ConvertTo-Json -Compress

Write-Host "🚀 正在推送最新 server.js 至桌機地端（觸發重啟）..." -ForegroundColor Cyan
$updateRes = Invoke-RestMethod -Uri "$url/api/system/update-server-code" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
Write-Host "🎉 地端回傳：$($updateRes.message)" -ForegroundColor Green

# 4. 等候地端業務服務重啟
Write-Host "⏳ 等候桌機業務服務重啟中..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 5. 驗證地端最新版本
Write-Host "🔍 正在驗證地端 API..." -ForegroundColor Yellow
$verified = $false

for ($v = 1; $v -le 6; $v++) {
    try {
        $config = Invoke-RestMethod -Uri "$url/api/get-global-config" -Method Get -ErrorAction Stop
        Write-Host "✅ 遠端部署成功！目前桌機版本：$($config.data.version)" -ForegroundColor Green
        $verified = $true
        break
    } catch {
        Write-Host "⏳ 服務拉起中，2 秒後重試 ($v/6)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $verified) {
    Write-Host "⚠️ 部署完成但驗證回應較慢，請開啟瀏覽器確認。" -ForegroundColor Yellow
}