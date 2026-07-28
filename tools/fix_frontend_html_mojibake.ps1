$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$targets = @(
    (Join-Path $root 'frontend\pages\*.html'),
    (Join-Path $root 'frontend\templates\*.html')
)

$enc1251 = [Text.Encoding]::GetEncoding(1251)
$utf8 = [Text.Encoding]::UTF8

$badDash = [string]([char]0x0432) + [char]0x0402 + [char]0x201D
$badBullet = [string]([char]0x0432) + [char]0x0402 + [char]0x045E
$badRuble = [string]([char]0x0432) + [char]0x201A + [char]0x0405
$badNumero = [string]([char]0x0432) + [char]0x201E + [char]0x2013
$goodDash = [string][char]0x2014
$goodBullet = [string][char]0x2022
$goodRuble = [string][char]0x20BD
$goodNumero = [string][char]0x2116
$replacementChar = [string][char]0xFFFD
$latinEth = [string][char]0x00D0
$latinEnye = [string][char]0x00D1
$mojiPairRegex = '([' + [char]0x0420 + [char]0x0421 + [char]0x0412 + ']).'

function Normalize-BadSymbols([string]$value) {
    return $value.
        Replace($script:badDash, $script:goodDash).
        Replace($script:badBullet, $script:goodBullet).
        Replace($script:badRuble, $script:goodRuble).
        Replace($script:badNumero, $script:goodNumero)
}

function Get-SuspicionScore([string]$value) {
    if ([string]::IsNullOrEmpty($value)) {
        return 0
    }

    $score = ([regex]::Matches($value, $script:mojiPairRegex)).Count * 2
    foreach ($token in @($script:badDash, $script:badBullet, $script:badRuble, $script:badNumero, $script:replacementChar, $script:latinEth, $script:latinEnye)) {
        if ($value.Contains($token)) {
            $score += 3
        }
    }
    return $score
}

function Convert-MojibakeLine([string]$value) {
    $current = Normalize-BadSymbols $value
    for ($index = 0; $index -lt 4; $index += 1) {
        $score = Get-SuspicionScore $current
        if ($score -le 0) {
            break
        }

        $next = Normalize-BadSymbols ($utf8.GetString($enc1251.GetBytes($current)))
        $nextScore = Get-SuspicionScore $next
        if ($next -eq $current -or $nextScore -ge $score) {
            break
        }

        $current = $next
    }
    return $current
}

$changedFiles = 0
$changedLines = 0

Get-ChildItem -Path $targets -File | ForEach-Object {
    $path = $_.FullName
    $text = [IO.File]::ReadAllText($path, [Text.UTF8Encoding]::new($false))
    $parts = [regex]::Split($text, "(`r`n|`n|`r)")
    $changed = $false

    for ($index = 0; $index -lt $parts.Count; $index += 1) {
        $part = $parts[$index]
        if ($part -notmatch "^(`r`n|`n|`r)$" -and (Get-SuspicionScore $part)) {
            $fixed = Convert-MojibakeLine $part
            if ($fixed -ne $part) {
                $parts[$index] = $fixed
                $changed = $true
                $changedLines += 1
            }
        }
    }

    if ($changed) {
        [IO.File]::WriteAllText($path, ($parts -join ''), [Text.UTF8Encoding]::new($false))
        $changedFiles += 1
        Write-Output ("fixed " + $_.Name)
    }
}

Write-Output ("changed_files=$changedFiles changed_lines=$changedLines")
