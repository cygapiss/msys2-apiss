param(
    [Parameter(Mandatory)]
    [int]$NodePid
)

. "$PSScriptRoot/kill-tree-shared.ps1"

$exclude = Initialize-TreeKillExclude -NodePid $NodePid

$roots = @($env:CI_TREE_KILL_SCAN_ROOTS -split '\|') | Where-Object { $_ }
$rootExes = @($env:CI_TREE_KILL_SCAN_ROOT_EXECUTABLES -split '\|') | Where-Object { $_ }

Get-CimInstance Win32_Process |
    Where-Object {
        $proc = $_
        $proc.ProcessId -notin $exclude -and $proc.ExecutablePath -and
        (Test-TreeKillExecutablePathMatch -Proc $proc -Roots $roots -Exes $rootExes)
    } |
    ForEach-Object {
        Write-Host ('Killing PID ' + $_.ProcessId + ': ' + $_.ExecutablePath)
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
