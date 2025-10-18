
param(
  [Parameter(Mandatory=$true)][string]$Base,
  [Parameter(Mandatory=$true)][string]$TaskSecret,
  [Parameter(Mandatory=$true)][string]$To,
  [string]$UserId = "u1",
  [string]$UserEmail = "demo@apaganet.test"
)

function Write-Ok($msg){ Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Step($msg){ Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Fail($msg){ Write-Host "❌ $msg" -ForegroundColor Red }

try {
  # 1) Mint JWT (admin)
  Write-Step "Mint JWT con TASK_SECRET..."
  $HEAD_ADMIN = @{ "Authorization" = "Bearer $TaskSecret"; "Content-Type" = "application/json" }
  $mint = Invoke-RestMethod -Method Get -Uri "$Base/admin/jwt?email=$([uri]::EscapeDataString($UserEmail))&id=$([uri]::EscapeDataString($UserId))" -Headers $HEAD_ADMIN
  if(-not $mint.ok){ throw "No se obtuvo JWT: $($mint | ConvertTo-Json -Depth 5)" }
  $JWT = $mint.token
  Write-Ok "JWT listo: $($JWT.Substring(0,30))..."

  # 2) HEADERS protegidos con JWT
  $HEAD_API = @{ "Authorization" = "Bearer $JWT"; "Content-Type" = "application/json" }

  # 3) Verificar router de email
  Write-Step "Verificar /api/email/verify..."
  $verify = Invoke-RestMethod -Method Get -Uri "$Base/api/email/verify" -Headers $HEAD_ADMIN
  if(-not $verify.ok){ throw "Verify fallo: $($verify | ConvertTo-Json -Depth 5)" }
  Write-Ok "Router email OK"

  # 4) Test simple de correo
  Write-Step "Enviar /api/email/test ..."
  $body = @{ to = $To } | ConvertTo-Json
  $t1 = Invoke-RestMethod -Method Post -Uri "$Base/api/email/test" -Headers $HEAD_ADMIN -Body $body
  if(-not $t1.ok){ throw "email/test fallo: $($t1 | ConvertTo-Json -Depth 5)" }
  Write-Ok "email/test OK id=$($t1.id)"

  # 5) Disparar alerta protegida (plantilla)
  Write-Step "Enviar /api/v1/alerts (JWT)..."
  $alertBody = @{
    device_id  = "DEV-TEST"
    level      = "critical"
    title      = "Smoke test de alerta"
    details_url= "https://tu-frontend.netlify.app/alerts/smoke"
    device_name= "Agente de prueba"
  } | ConvertTo-Json -Depth 5

  $res = Invoke-RestMethod -Method Post -Uri "$Base/api/v1/alerts" -Headers $HEAD_API -Body $alertBody
  if(-not $res.ok){ throw "/api/v1/alerts fallo: $($res | ConvertTo-Json -Depth 5)" }
  Write-Ok "/api/v1/alerts OK"

  Write-Host ""
  Write-Ok "Todo bien. Revisa tu correo ($To)."

} catch {
  Write-Fail $_
  exit 1
}
