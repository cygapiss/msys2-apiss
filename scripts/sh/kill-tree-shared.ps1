function Initialize-TreeKillExclude {
    param(
        [Parameter(Mandatory)]
        [int]$NodePid
    )

    $exclude = @($PID, $NodePid)
    $shellExplorerPid = (
        Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty ProcessId -First 1
    )
    $walker = Get-CimInstance Win32_Process -Filter "ProcessId=$NodePid" -ErrorAction SilentlyContinue
    while ($walker -and $walker.ParentProcessId) {
        $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $walker.ParentProcessId) -ErrorAction SilentlyContinue
        if (-not $ancestor) { break }
        if ($shellExplorerPid -and $ancestor.ProcessId -eq $shellExplorerPid) {
            $walker = $ancestor
            continue
        }
        $exclude += $ancestor.ProcessId
        $walker = $ancestor
    }

    return $exclude
}

function Test-TreeKillExecutablePathMatch {
    param(
        $Proc,
        [string[]]$Roots,
        [string[]]$Exes
    )

    foreach ($root in $Roots) {
        if (-not $root) { continue }
        $prefix = if ($root -and -not $root.EndsWith('\')) { $root + '\' } else { $root }
        if ($Proc.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    foreach ($exe in $Exes) {
        if (-not $exe) { continue }
        if ($Proc.ExecutablePath -ieq $exe) {
            return $true
        }
    }

    return $false
}
