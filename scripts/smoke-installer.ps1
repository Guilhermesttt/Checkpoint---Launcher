$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $root
try {
  node scripts/verify-release.cjs
  if ($LASTEXITCODE -ne 0) { throw "Falha na verificacao do release." }

  $latest = Get-Content (Join-Path $root "release/latest.yml") -Raw
  $artifactName = [regex]::Match($latest, "(?m)^path:\s*(.+)$").Groups[1].Value.Trim()
  $installer = Join-Path $root "release/$artifactName"
  if (-not (Test-Path -LiteralPath $installer)) { throw "Instalador nao encontrado: $installer" }

  $signature = Get-AuthenticodeSignature -LiteralPath $installer
  if ($env:REQUIRE_SIGNED_RELEASE -eq "1" -and $signature.Status -ne "Valid") {
    throw "Assinatura obrigatoria, status atual: $($signature.Status)"
  }

  $installDir = Join-Path $env:TEMP "checkpoint-launcher-smoke"
  if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force }
  $install = Start-Process -FilePath $installer -ArgumentList @("/S", "/D=$installDir") -Wait -PassThru -WindowStyle Hidden
  if ($install.ExitCode -ne 0) { throw "Instalador retornou $($install.ExitCode)." }

  $executable = Get-ChildItem -LiteralPath $installDir -Filter "*.exe" |
    Where-Object { $_.Name -notmatch "uninstall" } |
    Select-Object -First 1
  if (-not $executable) { throw "Executavel instalado nao encontrado." }

  # Ambientes de automacao podem definir esta variavel para executar Electron como Node.
  # O smoke precisa validar o runtime Electron real do artefato instalado.
  $previousElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  try {
    $smoke = Start-Process -FilePath $executable.FullName -ArgumentList "--smoke-test" -Wait -PassThru -WindowStyle Hidden
  } finally {
    if ($null -ne $previousElectronRunAsNode) { $env:ELECTRON_RUN_AS_NODE = $previousElectronRunAsNode }
  }
  if ($smoke.ExitCode -ne 0) { throw "Smoke do aplicativo retornou $($smoke.ExitCode)." }

  $uninstaller = Get-ChildItem -LiteralPath $installDir -Filter "Uninstall*.exe" | Select-Object -First 1
  if ($uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait -PassThru -WindowStyle Hidden
    if ($uninstall.ExitCode -ne 0) { throw "Desinstalador retornou $($uninstall.ExitCode)." }
  }

  Write-Host "[release:smoke] instalacao, inicializacao e desinstalacao validadas. Assinatura: $($signature.Status)"
} finally {
  Pop-Location
}
