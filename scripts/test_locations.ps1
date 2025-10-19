# scripts/test_locations.ps1
param(
  [string]$API_URL = $env:API_URL,
  [string]$TOKEN   = $env:TOKEN
)

if (-not $API_URL) { Write-Error "Set-Variable API_URL first"; exit 1 }
if (-not $TOKEN)   { Write-Error "Set-Variable TOKEN first"; exit 1 }

function CallApi($method, $path, $bodyJson) {
  $headers = @{ Authorization = "Bearer $TOKEN" }
  if ($null -ne $bodyJson) {
    return Invoke-RestMethod -Uri "$API_URL$path" -Method $method -Headers $headers -ContentType "application/json" -Body $bodyJson
  } else {
    return Invoke-RestMethod -Uri "$API_URL$path" -Method $method -Headers $headers
  }
}

Write-Host "== Create geofence =="
$gf = CallApi "POST" "/geofences" '{"name":"Casa","lat":19.4326,"lng":-99.1332,"radius_m":250}'
$gf | ConvertTo-Json -Depth 6

Write-Host "`n== Report location (mock CDMX) =="
$loc = CallApi "POST" "/locations/report" '{"device_id":"AA:BB:CC:11:22:33","lat":19.4326,"lng":-99.1332,"accuracy":20}'
$loc | ConvertTo-Json -Depth 6

Write-Host "`n== Latest =="
$latest = CallApi "GET" "/locations/latest?device_id=AA:BB:CC:11:22:33" $null
$latest | ConvertTo-Json -Depth 6

Write-Host "`n== List geofences =="
$list = CallApi "GET" "/geofences" $null
$list | ConvertTo-Json -Depth 6
