$headers = @{ "X-Master-Key" = '$2a$10$0nr9sKdkJWcR9BBU1l7dLO8DN1ET8JzYNWyAGYEH4VAI6e1Ov23Tm' }
$res = Invoke-RestMethod -Uri "https://api.jsonbin.io/v3/b/6b06da24ac6210605aa35103/latest" -Headers $headers
$url = $res.record.url.Trim()
Write-Host "✅ 成功抓取地端網址：$url" -ForegroundColor Green
Invoke-RestMethod -Uri "$url/api/system/restart" -Method Post -ContentType "application/json" -Body '{"action":"restart"}'