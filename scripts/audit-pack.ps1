param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$KeepTemp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$bundleName = "audit_bundle_$timestamp.zip"
$outputRoot = Join-Path $ProjectRoot "audit_out"
$tempRoot = Join-Path $outputRoot "tmp_$timestamp"
$zipPath = Join-Path $outputRoot $bundleName
$projectRootSafeLabel = Split-Path -Leaf $ProjectRoot
if ([string]::IsNullOrWhiteSpace($projectRootSafeLabel)) {
  $projectRootSafeLabel = "[redacted]"
}

$rootFiles = @(
  "AGENTS.md",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "index.html",
  ".gitignore"
)

$viteConfigs = Get-ChildItem -Path $ProjectRoot -File -Filter "vite.config.*" -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty Name
$rootFiles += $viteConfigs

$includeDirs = @("docs", "data", "src", "scripts", "backend")
$publicPath = Join-Path $ProjectRoot "public"
if (Test-Path -LiteralPath $publicPath -PathType Container) {
  $publicFiles = (Get-ChildItem -Path $publicPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($publicFiles -gt 0) {
    $includeDirs += "public"
  }
}

$excludedDirNames = @(
  "node_modules",
  "dist",
  "build",
  ".git",
  ".vite",
  "coverage",
  ".cache",
  "cache",
  "logs",
  "log"
)

$excludedFilePatterns = @(
  "*.env",
  "*.env.*",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.cache",
  "*.pid",
  "*.bak",
  "*.swp",
  "*.swo",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "pnpm-debug.log*"
)

$excludedSecretPatterns = @(
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "*.crt",
  "*.cer",
  "*.secret",
  "*.secrets",
  "*.token",
  "secrets.*",
  "id_rsa",
  "id_rsa.*",
  "id_dsa",
  "id_dsa.*"
)

$excludedBinaryExtensions = @(
  ".zip",
  ".7z",
  ".rar",
  ".gz",
  ".tar",
  ".bin",
  ".dll",
  ".exe",
  ".iso",
  ".dmg",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv"
)

$maxFileSizeBytes = 10MB

function To-RelativePath {
  param([string]$Path)
  $resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd("\")
  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  if ($resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $resolvedPath.Substring($resolvedRoot.Length).TrimStart("\").Replace("\", "/")
  }
  return $resolvedPath.Replace("\", "/")
}

function Test-ExcludedByDir {
  param([string]$RelativePath)
  foreach ($dirName in $excludedDirNames) {
    $escaped = [Regex]::Escape($dirName)
    if ($RelativePath -match "(^|/)$escaped(/|$)") {
      return $true
    }
  }
  return $false
}

function Test-ExcludedByFilePattern {
  param([string]$FileName)
  foreach ($pattern in $excludedFilePatterns + $excludedSecretPatterns) {
    if ($FileName -like $pattern) {
      return $true
    }
  }
  return $false
}

function Test-ExcludedByBinaryPolicy {
  param([System.IO.FileInfo]$File)
  $ext = $File.Extension.ToLowerInvariant()
  if (($excludedBinaryExtensions -contains $ext) -and $File.Length -gt 1MB) {
    return $true
  }
  if ($File.Length -gt $maxFileSizeBytes) {
    return $true
  }
  return $false
}

function Test-ShouldIncludeFile {
  param([System.IO.FileInfo]$File)
  $relative = To-RelativePath -Path $File.FullName
  if (Test-ExcludedByDir -RelativePath $relative) {
    return $false
  }
  if (Test-ExcludedByFilePattern -FileName $File.Name) {
    return $false
  }
  if (Test-ExcludedByBinaryPolicy -File $File) {
    return $false
  }
  return $true
}

function Copy-AuditFile {
  param([string]$SourceFilePath)
  $relative = To-RelativePath -Path $SourceFilePath
  $destination = Join-Path $tempRoot $relative
  $destinationDir = Split-Path -Parent $destination
  if (!(Test-Path -LiteralPath $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }
  Copy-Item -LiteralPath $SourceFilePath -Destination $destination -Force
  return $relative
}

if (!(Test-Path -LiteralPath $outputRoot)) {
  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
}

if (Test-Path -LiteralPath $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

$includedFiles = New-Object System.Collections.Generic.List[string]

foreach ($name in ($rootFiles | Sort-Object -Unique)) {
  $fullPath = Join-Path $ProjectRoot $name
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    $fileInfo = Get-Item -LiteralPath $fullPath
    if (Test-ShouldIncludeFile -File $fileInfo) {
      $includedFiles.Add((Copy-AuditFile -SourceFilePath $fullPath))
    }
  }
}

foreach ($dir in ($includeDirs | Sort-Object -Unique)) {
  $fullDir = Join-Path $ProjectRoot $dir
  if (!(Test-Path -LiteralPath $fullDir -PathType Container)) {
    continue
  }

  $files = Get-ChildItem -LiteralPath $fullDir -Recurse -File -Force
  foreach ($file in $files) {
    if (Test-ShouldIncludeFile -File $file) {
      $includedFiles.Add((Copy-AuditFile -SourceFilePath $file.FullName))
    }
  }
}

$sortedIncluded = $includedFiles | Sort-Object -Unique
$manifestPath = Join-Path $tempRoot "audit_manifest.txt"
$manifestContent = @(
  "bundle_name: $bundleName",
  "generated_at: $(Get-Date -Format o)",
  "project_root: $projectRootSafeLabel",
  "file_count: $($sortedIncluded.Count)",
  "",
  "files:"
)
$manifestContent += ($sortedIncluded | ForEach-Object { "- $_" })
$manifestContent | Set-Content -LiteralPath $manifestPath -Encoding utf8
$sortedIncluded += "audit_manifest.txt"

$archiveEntries = Get-ChildItem -LiteralPath $tempRoot -Force | Select-Object -ExpandProperty FullName
Compress-Archive -Path $archiveEntries -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host "AUDIT_BUNDLE_PATH=$zipPath"
Write-Host "AUDIT_BUNDLE_FILE_COUNT=$($sortedIncluded.Count)"
Write-Host "AUDIT_BUNDLE_FILES_BEGIN"
$sortedIncluded | Sort-Object -Unique | ForEach-Object { Write-Host $_ }
Write-Host "AUDIT_BUNDLE_FILES_END"

if (-not $KeepTemp) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
