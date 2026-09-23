$headers = @{ "X-Master-Key" = '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm' }
$res = Invoke-RestMethod -Uri "https://api.jsonbin.io/v3/b/6aad2ed2ac6210605adc4575/latest" -Headers $headers
$url = $res.record.url.Trim()
Write-Host "✅ 成功抓取地端網址：$url" -ForegroundColor Green
Invoke-RestMethod -Uri "$url/api/system/restart" -Method Post -ContentType "application/json" -Body '{"action":"restart"}'