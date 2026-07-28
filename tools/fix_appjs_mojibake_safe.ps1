$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot '..\frontend\assets\app.js'
$path = [IO.Path]::GetFullPath($path)

$text = [IO.File]::ReadAllText($path, [Text.UTF8Encoding]::new($false))
$enc1251 = [Text.Encoding]::GetEncoding(1251)
$utf8 = [Text.Encoding]::UTF8

$r = [string][char]0x0420
$s = [string][char]0x0421
$v = [string][char]0x0412
$nbsp = [string][char]0x00A0
$replacementChar = [string][char]0xFFFD
$latinEth = [string][char]0x00D0
$latinEnye = [string][char]0x00D1

$badDash = [string]([char]0x0432) + [char]0x0402 + [char]0x201D
$badBullet = [string]([char]0x0432) + [char]0x0402 + [char]0x045E
$badRuble = [string]([char]0x0432) + [char]0x201A + [char]0x0405
$badNumero = [string]([char]0x0432) + [char]0x201E + [char]0x2013
$goodDash = [string][char]0x2014
$goodBullet = [string][char]0x2022
$goodRuble = [string][char]0x20BD
$goodNumero = [string][char]0x2116

function Normalize-BadSymbols([string]$value) {
    return $value.
        Replace($script:badDash, $script:goodDash).
        Replace($script:badBullet, $script:goodBullet).
        Replace($script:badRuble, $script:goodRuble).
        Replace($script:badNumero, $script:goodNumero)
}

function Normalize-MojibakeSpacing([string]$value) {
    return $value
}

function Normalize-FinalText([string]$value) {
    return $value.Replace(($script:replacementChar + '?'), [string][char]0x0439)
}

function Count-Substring([string]$value, [string]$needle) {
    if ([string]::IsNullOrEmpty($value) -or [string]::IsNullOrEmpty($needle)) {
        return 0
    }
    return ([regex]::Matches($value, [regex]::Escape($needle))).Count
}

function Get-MojibakeScore([string]$value) {
    if ([string]::IsNullOrEmpty($value)) {
        return 0
    }

    $score = 0
    $score += (Count-Substring $value $script:replacementChar) * 40
    $score += (Count-Substring $value $script:latinEth) * 20
    $score += (Count-Substring $value $script:latinEnye) * 20
    $score += (Count-Substring $value ($script:r + $script:nbsp)) * 12
    $score += (Count-Substring $value ($script:r + [string][char]0x0402)) * 12
    $score += (Count-Substring $value ($script:s + [string][char]0x0403)) * 12
    $score += (Count-Substring $value ($script:s + [string][char]0x040A)) * 12
    $score += (Count-Substring $value ($script:s + [string][char]0x040B)) * 12
    $score += ([regex]::Matches($value, '(' + $script:r + '|' + $script:s + '|' + $script:v + ')[\u0400-\u040F\u0450-\u045F\u00A0-\u00BF\u2010-\u203A]')).Count * 10
    return $score
}

function Convert-Mojibake([string]$value) {
    $current = $value
    $best = Normalize-FinalText (Normalize-BadSymbols $current)
    $bestScore = Get-MojibakeScore $best

    for ($index = 0; $index -lt 5; $index += 1) {
        $candidate = Normalize-FinalText (Normalize-MojibakeSpacing (Normalize-BadSymbols $current))
        $candidateScore = Get-MojibakeScore $candidate
        if ($candidateScore -lt $bestScore) {
            $best = $candidate
            $bestScore = $candidateScore
        }

        $next = $utf8.GetString($enc1251.GetBytes($current))
        if ($next -eq $current) {
            break
        }
        $current = $next
    }

    return $best
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
