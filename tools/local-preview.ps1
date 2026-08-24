[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 4173,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist-github'))
$indexPath = Join-Path $siteRoot 'index.html'
$address = "http://127.0.0.1:$Port/"

if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  Write-Host 'The local dashboard build is missing.' -ForegroundColor Red
  Write-Host 'Ask Codex to rebuild the GitHub/local version, then try again.'
  exit 1
}

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.js'   { 'application/javascript; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.map'  { 'application/json; charset=utf-8' }
    '.svg'  { 'image/svg+xml' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.gif'  { 'image/gif' }
    '.ico'  { 'image/x-icon' }
    '.woff' { 'font/woff' }
    '.woff2' { 'font/woff2' }
    default { 'application/octet-stream' }
  }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($address)

try {
  $listener.Start()
  Write-Host "Local dashboard: $address" -ForegroundColor Cyan
  Write-Host 'Keep this window open while using the dashboard.'
  Write-Host 'Close this window or press Ctrl+C to stop.'

  if (-not $NoBrowser) {
    Start-Process $address
  }

  $rootPrefix = $siteRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
      $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = 'index.html'
      }

      $relativePath = $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath))
      $insideSite = $candidatePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($candidatePath, $siteRoot, [System.StringComparison]::OrdinalIgnoreCase)

      if (-not $insideSite) {
        $response.StatusCode = 403
        continue
      }

      if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
        $candidatePath = $indexPath
      }

      $bytes = [System.IO.File]::ReadAllBytes($candidatePath)
      $response.StatusCode = 200
      $response.ContentType = Get-ContentType $candidatePath
      $response.ContentLength64 = $bytes.Length
      $response.Headers['Cache-Control'] = 'no-store'
      $response.Headers['X-Content-Type-Options'] = 'nosniff'

      if ($context.Request.HttpMethod -ne 'HEAD') {
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    }
    catch {
      $response.StatusCode = 500
    }
    finally {
      $response.OutputStream.Close()
    }
  }
}
catch {
  Write-Host "Could not start the local dashboard on $address" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
