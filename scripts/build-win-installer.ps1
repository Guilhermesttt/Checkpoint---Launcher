$ErrorActionPreference = "Stop"

function Invoke-Builder {
  param(
    [string[]] $ExtraArgs = @()
  )

  & npx.cmd --no-install electron-builder --win nsis @ExtraArgs
  return $LASTEXITCODE
}

$exitCode = Invoke-Builder
if ($exitCode -eq 0) {
  exit 0
}

$electronDist = Join-Path (Get-Location) "release\win-unpacked.tmp"
if (-not (Test-Path -LiteralPath $electronDist)) {
  exit $exitCode
}

Write-Host "electron-builder hit a Windows rename lock. Retrying with electronDist=$electronDist"
$retryExitCode = Invoke-Builder -ExtraArgs @("--config.electronDist=$electronDist")
exit $retryExitCode
