$ErrorActionPreference = 'Stop'
# Run in your own terminal. SSH and Python hide input; no password in arguments.
$mailKey = Join-Path $env:USERPROFILE '.ssh/codex_crm_193_187_94_165'
ssh -t -i $mailKey root@193.187.94.165 'sh /opt/crm/deploy/autobot-mail/password.sh'
if ($LASTEXITCODE -ne 0) { throw 'Password setup did not complete.' }
