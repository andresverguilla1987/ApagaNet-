
param(
  [Parameter(Mandatory=$true)][string]$Base,
  [Parameter(Mandatory=$true)][string]$TaskSecret,
  [Parameter(Mandatory=$true)][string]$To
)

function Write-Ok($msg){ Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Step($msg){ Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Fail($msg){ Write-Host "❌ $msg" -ForegroundColor Red }

try{
  $HEAD_ADMIN = @{ "Authorization" = "Bearer $TaskSecret"; "Content-Type" = "application/json" }

  Write-Step "Disparar nota administrativa /admin/notifications/dispatch ..."
  $note = @{
    title = "Actividad inusual detectada"
    level = "critical"
    body  = "Intento de acceso desde IP desconocida"
    link  = "https://tu-frontend.netlify.app/alerts/123"
    filter= @{ byChannel=@("email"); byLevels=@("critical"); to=@($To) }
  } | ConvertTo-Json -Depth 5

  $r = Invoke-RestMethod -Method Post -Uri "$Base/admin/notifications/dispatch" -Headers $HEAD_ADMIN -Body $note
  if(-not $r.ok){ throw "dispatch fallo: $($r | ConvertTo-Json -Depth 5)" }
  Write-Ok "dispatch OK (count_alerts_sent=$($r.count_alerts_sent))"

} catch {
  Write-Fail $_
  exit 1
}
