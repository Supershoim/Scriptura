# Registers tools/serve.mjs as a Windows scheduled task "Scriptura server": hidden, started at boot
# (or at logon if Windows refuses a boot task without admin rights), restarted if it stops.
# Usage: powershell -ExecutionPolicy Bypass -File tools/autostart.ps1 [-Port 8080] [-Remove]
param([int]$Port = 8080, [switch]$Remove)

$name = 'Scriptura server'
if ($Remove) { Unregister-ScheduledTask -TaskName $name -Confirm:$false; return }

$root = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node).Source
$user = "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

try {
  # S4U: runs without a visible window and without anyone logged on; stores no password.
  $action = New-ScheduledTaskAction -Execute $node -Argument "tools/serve.mjs $Port" -WorkingDirectory $root
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U
  Register-ScheduledTask -TaskName $name -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
  Write-Host "Registered '$name' at system startup."
} catch {
  # Without admin rights: start at logon, in a headless console so no window shows.
  $action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" tools/serve.mjs $Port" -WorkingDirectory $root
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive
  Register-ScheduledTask -TaskName $name -Action $action -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $user) -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "Registered '$name' at logon (startup needs admin: $($_.Exception.Message))."
}
Start-ScheduledTask -TaskName $name
