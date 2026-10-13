$ErrorActionPreference = "Stop"
$app = Join-Path $PSScriptRoot "server/app.py"

# Prefer Codex's bundled runtime when it is installed on this machine.
$bundledPython = Join-Path $env:USERPROFILE ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython -u $app
    exit $LASTEXITCODE
}

$pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pythonLauncher) {
    & $pythonLauncher.Source -3 $app
    if ($LASTEXITCODE -eq 0) { exit 0 }
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    & $python.Source $app
    exit $LASTEXITCODE
}

Write-Error "Python 3 is required. Install it or set up the Codex bundled runtime, then run this script again."
