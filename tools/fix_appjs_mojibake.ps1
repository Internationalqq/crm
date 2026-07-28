$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot '..\frontend\assets\app.js'
$path = [IO.Path]::GetFullPath($path)

$text = [IO.File]::ReadAllText($path, [Text.UTF8Encoding]::new($false))
$enc1251 = [Text.Encoding]::GetEncoding(1251)
$utf8 = [Text.Encoding]::UTF8

$pairRegex = '([' + [char]0x0420 + [char]0x0421 + [char]0x0412 + ']).'
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

function Get-MojiPairCount([string]$value) {
    return ([regex]::Matches($value, $script:pairRegex)).Count
}

function Normalize-BadSymbols([string]$value) {
    return $value.
        Replace($script:badDash, $script:goodDash).
        Replace($script:badBullet, $script:goodBullet).
        Replace($script:badRuble, $script:goodRuble).
        Replace($script:badNumero, $script:goodNumero)
}

function Test-IsSuspicious([string]$value) {
    if ([string]::IsNullOrEmpty($value)) {
        return $false
    }

    if (
        $value.Contains($script:badDash) -or
        $value.Contains($script:badBullet) -or
        $value.Contains($script:badRuble) -or
        $value.Contains($script:badNumero) -or
        $value.Contains($script:replacementChar) -or
        $value.Contains($script:latinEth) -or
        $value.Contains($script:latinEnye)
    ) {
        return $true
    }

    return (Get-MojiPairCount $value) -ge 2
}

function Convert-Mojibake([string]$value) {
    $current = Normalize-BadSymbols $value

    for ($index = 0; $index -lt 3; $index += 1) {
        if (-not (Test-IsSuspicious $current)) {
            break
        }

        $bytes = $enc1251.GetBytes($current)
        $next = $utf8.GetString($bytes)
        if ($next -eq $current) {
            break
        }

        $current = Normalize-BadSymbols $next
    }

    return Normalize-BadSymbols $current
}

$pattern = '(?s)''(?:\\.|[^''\\])*''|"(?:\\.|[^"\\])*"'
$changed = 0

$result = [regex]::Replace(
    $text,
    $pattern,
    [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)

        $literal = $match.Value
        if ($literal.Length -lt 2) {
            return $literal
        }

        $quote = $literal.Substring(0, 1)
        $inner = $literal.Substring(1, $literal.Length - 2)
        if (-not (Test-IsSuspicious $inner)) {
            return $literal
        }

        $fixed = Convert-Mojibake $inner
        if ($fixed -ne $inner) {
            $script:changed += 1
            return $quote + $fixed + $quote
        }

        return $literal
    }
)

[IO.File]::WriteAllText($path, $result, [Text.UTF8Encoding]::new($false))
Write-Output ("changed=$changed")
