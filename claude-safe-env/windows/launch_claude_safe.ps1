param(
    [switch]$CheckOnly,
    [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CheckScript = Join-Path $ScriptDir "preflight_check.py"

$output = & python $CheckScript 2>&1 | Out-String
$exitCode = $LASTEXITCODE
Write-Host $output

if ($exitCode -ne 0) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Claude 安全启动被拦截！请先检查 Clash Verge 与美区落地节点：`n`n$output",
        "Claude 网络安检未通过",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit $exitCode
}

if ($CheckOnly) {
    exit 0
}

$ChromeExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ClaudeUserData = "$env:LOCALAPPDATA\Google\Chrome\Claude-US"
New-Item -ItemType Directory -Path "$ClaudeUserData\Default" -Force | Out-Null
$PrefPath = "$ClaudeUserData\Default\Preferences"
if (-not (Test-Path $PrefPath)) {
    @'
{
  "intl": { "accept_languages": "en-US,en" },
  "webrtc": { "ip_handling_policy": "disable_non_proxied_udp" },
  "browser": { "has_seen_welcome_page": true }
}
'@ | Set-Content -Path $PrefPath -Encoding UTF8
}

if (-not $SkipBrowser -and (Test-Path $ChromeExe)) {
    $chromeArgs = @(
        "--user-data-dir=`"$ClaudeUserData`"",
        "--webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--enforce-webrtc-ip-permission-check",
        "--lang=en-US",
        "--no-first-run",
        "--no-default-browser-check",
        "https://claude.ai"
    )
    Start-Process -FilePath $ChromeExe -ArgumentList $chromeArgs
    Start-Sleep -Seconds 1
}

$claudeApp = (Get-StartApps | Where-Object { $_.Name -eq "Claude" } | Select-Object -First 1).AppID
if ($claudeApp) {
    Start-Process "shell:AppsFolder\$claudeApp"
}
