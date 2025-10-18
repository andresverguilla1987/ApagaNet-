Param(
  [Parameter(Mandatory=$true)][string]$Base,
  [string]$TaskSecret,
  [string]$To
)

function Hit($Method, $Path, $Body=$null, $Headers=@{}) {
  $Uri = "$Base$Path"
  try {
    if ($Body) {
      $json = $Body | ConvertTo-Json -Depth 6
      $resp = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -Body $json -ContentType 'application/json'
    } else {
      $resp = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
    }
    Write-Host "[$Method] $Path  => OK" -ForegroundColor Green
    return $resp
  } catch {
    Write-Host "[$Method] $Path  => FAIL $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    throw
  }
}

Write-Host "== ApagaNet Phase 3 Smoke =="
Write-Host "Base: $Base"

Hit 'GET' '/api/ping' | Out-Null
Hit 'GET' '/api/health' | Out-Null
Hit 'GET' '/api/diag' | Out-Null

if ($TaskSecret) {
  $H = @{ 'X-Task-Secret' = $TaskSecret }
  # Alta suscripción (email) si se especifica -To
  if ($To) {
    Hit 'POST' '/api/subscriptions' @{ channel='email'; target=$To } $H | Out-Null
  }
  # Dispatch de prueba
  Hit 'POST' '/api/dispatch' @{ title='Smoke Dispatch'; message='Hola desde smoke'; level='info' } $H | Out-Null
}

Write-Host "== Smoke terminado ==" -ForegroundColor Cyan
