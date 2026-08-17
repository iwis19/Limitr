param(
  [string]$FrontendDist,
  [string]$BackendStatic
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$resourcesRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "backend/src/main/resources"))

function Resolve-RepositoryPath([string]$Path, [string]$DefaultPath) {
  $selectedPath = if ([string]::IsNullOrWhiteSpace($Path)) { $DefaultPath } else { $Path }
  if ([System.IO.Path]::IsPathRooted($selectedPath)) {
    return [System.IO.Path]::GetFullPath($selectedPath)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $selectedPath))
}

$frontendDistPath = Resolve-RepositoryPath $FrontendDist "frontend/dist/limitr-frontend/browser"
$backendStaticPath = Resolve-RepositoryPath $BackendStatic "backend/src/main/resources/static"

if (!(Test-Path -LiteralPath $frontendDistPath -PathType Container)) {
  throw "Frontend dist path not found: $frontendDistPath"
}

$resourcesPrefix = $resourcesRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (!$backendStaticPath.StartsWith($resourcesPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to replace a directory outside backend resources: $backendStaticPath"
}

if (!(Test-Path -LiteralPath $backendStaticPath)) {
  New-Item -ItemType Directory -Force -Path $backendStaticPath | Out-Null
}

Get-ChildItem -LiteralPath $backendStaticPath -Force | Remove-Item -Force -Recurse
Copy-Item -Path (Join-Path $frontendDistPath "*") -Destination $backendStaticPath -Recurse -Force

Write-Host "Copied frontend build from '$frontendDistPath' to '$backendStaticPath'."
