param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [string]$Destination = "reference\legacy-crm"
)

$ErrorActionPreference = "Stop"

$workspace = Resolve-Path -LiteralPath "."
$destParent = Split-Path -Path $Destination -Parent
if ($destParent -and -not (Test-Path -LiteralPath $destParent)) {
    New-Item -ItemType Directory -Path $destParent | Out-Null
}

if (Test-Path -LiteralPath $Destination) {
    throw "Destination already exists: $Destination. Rename or remove it manually before importing."
}

$sourcePath = Resolve-Path -LiteralPath $Source
$destFull = Join-Path $workspace.Path $Destination

if ((Get-Item -LiteralPath $sourcePath.Path).PSIsContainer) {
    Copy-Item -LiteralPath $sourcePath.Path -Destination $destFull -Recurse
    Write-Host "Copied legacy CRM folder to $destFull"
    exit 0
}

if ($sourcePath.Path -match '\.zip$') {
    New-Item -ItemType Directory -Path $destFull | Out-Null
    Expand-Archive -LiteralPath $sourcePath.Path -DestinationPath $destFull
    Write-Host "Extracted legacy CRM zip to $destFull"
    exit 0
}

throw "Unsupported source. Pass a folder or .zip archive."
