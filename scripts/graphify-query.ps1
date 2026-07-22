<#
.SYNOPSIS
  Token-efficient reader for graphify-out/. Answers questions about this
  codebase from the pre-built knowledge graph instead of reading source files.

.DESCRIPTION
  Wraps `python -m graphify` so agents/humans can query graphify-out/graph.json
  with a bounded token budget. Reuses the cached interpreter recorded in
  graphify-out/.graphify_python so nothing has to be re-detected.

.EXAMPLE
  ./scripts/graphify-query.ps1 "How does auth token refresh work?"
  ./scripts/graphify-query.ps1 -Mode explain "AuthModule"
  ./scripts/graphify-query.ps1 -Mode path "auth" "user"
  ./scripts/graphify-query.ps1 -Budget 1500 "Trace the appointment status flow"
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [ValidateSet('query', 'explain', 'path')]
    [string]$Mode = 'query',
    [int]$Budget = 1200,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'graphify-out'
$graph = Join-Path $outDir 'graph.json'

if (-not (Test-Path $graph)) {
    Write-Error "graphify-out/graph.json not found. Build it first with /graphify."
    exit 1
}

# Resolve the interpreter that actually has graphify (cached, then fallbacks).
$pyFile = Join-Path $outDir '.graphify_python'
$py = $null
if (Test-Path $pyFile) { $py = (Get-Content $pyFile -Raw).Trim() }
if (-not $py -or -not (Test-Path $py)) {
    $py = (Get-Command python -ErrorAction SilentlyContinue).Source
}
if (-not $py) { Write-Error "No Python interpreter with graphify found."; exit 1 }

if (-not $Rest -or $Rest.Count -eq 0) {
    Write-Error "Nothing to ask. Usage: graphify-query.ps1 [-Mode query|explain|path] [-Budget N] <text...>"
    exit 1
}

switch ($Mode) {
    'explain' { & $py -m graphify explain $Rest[0] --graph $graph }
    'path'    { & $py -m graphify path $Rest[0] $Rest[1] --graph $graph }
    default   {
        $question = $Rest -join ' '
        & $py -m graphify query $question --budget $Budget --graph $graph
    }
}
