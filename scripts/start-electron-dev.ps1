$ErrorActionPreference = "Stop"

Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:ELECTRON_START_URL = "http://127.0.0.1:5173"

& npx.cmd electron .
exit $LASTEXITCODE
