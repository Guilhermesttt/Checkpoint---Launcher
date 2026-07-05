$ErrorActionPreference = "Stop"

Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:ELECTRON_START_URL = "http://127.0.0.1:5173"

$electronBinary = Join-Path $PSScriptRoot "..\node_modules\electron\dist\electron.exe"
& $electronBinary .
exit $LASTEXITCODE
