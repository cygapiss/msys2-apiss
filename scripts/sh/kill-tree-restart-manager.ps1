param(
    [Parameter(Mandatory)]
    [int]$NodePid
)

. "$PSScriptRoot/kill-tree-shared.ps1"

$exclude = Initialize-TreeKillExclude -NodePid $NodePid

$deleteFolder = $env:CI_TREE_KILL_DELETE_FOLDER
$roots = @($deleteFolder)
$lockerExes = @($env:CI_TREE_KILL_LOCKER_EXECUTABLES -split '\|') | Where-Object { $_ }

if (-not $deleteFolder) {
    Write-Host 'Restart Manager: CI_TREE_KILL_DELETE_FOLDER not set; nothing to scan'
    exit 0
}

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TreeRmKill {
  const int CCH_RM_MAX_APP_NAME = 255;
  const int CCH_RM_MAX_SVC_NAME = 63;
  const int ERROR_MORE_DATA = 234;
  [StructLayout(LayoutKind.Sequential)]
  public struct RM_UNIQUE_PROCESS {
    public int dwProcessId;
    public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
    public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
    public string strServiceShortName;
    public uint ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
  }
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, StringBuilder strSessionKey);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, IntPtr rgApplications, uint nServices, string[] rgsServiceNames);
  [DllImport("rstrtmgr.dll")]
  static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);
  [DllImport("rstrtmgr.dll")]
  static extern int RmEndSession(uint pSessionHandle);
  public static int[] GetLockingPids(string[] treePaths) {
    uint handle;
    var key = new StringBuilder(256);
    int hr = RmStartSession(out handle, 0, key);
    if (hr != 0) throw new Exception("RmStartSession failed: " + hr);
    try {
      hr = RmRegisterResources(handle, (uint)treePaths.Length, treePaths, 0, IntPtr.Zero, 0, null);
      if (hr != 0) throw new Exception("RmRegisterResources failed: " + hr);
      uint needed = 0, count = 0, reboot = 0;
      hr = RmGetList(handle, out needed, ref count, null, ref reboot);
      if (hr != 0 && hr != ERROR_MORE_DATA) throw new Exception("RmGetList failed: " + hr);
      if (needed == 0) return new int[0];
      count = needed;
      var infos = new RM_PROCESS_INFO[count];
      hr = RmGetList(handle, out needed, ref count, infos, ref reboot);
      if (hr != 0) throw new Exception("RmGetList failed: " + hr);
      var pids = new int[count];
      for (uint i = 0; i < count; i++) pids[i] = infos[i].Process.dwProcessId;
      return pids;
    } finally {
      RmEndSession(handle);
    }
  }
}
'@

$treeFiles = @(
    Get-ChildItem -LiteralPath $deleteFolder -Recurse -File -Force -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
)
if ($treeFiles.Count -eq 0) {
    Write-Host ('Restart Manager: no files under ' + $deleteFolder + ' to register')
} else {
    Write-Host ('Restart Manager: registering ' + $treeFiles.Count + ' files under ' + $deleteFolder)
}

try {
    $pids = [TreeRmKill]::GetLockingPids($treeFiles)
} catch {
    Write-Host ('Restart Manager: failed to enumerate lockers: ' + $_.Exception.Message)
    $pids = @()
}
if (@($pids).Count -eq 0) {
    Write-Host 'Restart Manager: no locking processes reported'
}

foreach ($procId in $pids) {
    $proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $procId) -ErrorAction SilentlyContinue
    $procName = if ($proc -and $proc.Name) { $proc.Name } else { '<unknown>' }
    $procPath = if ($proc -and $proc.ExecutablePath) { $proc.ExecutablePath } else { '<null ExecutablePath>' }
    Write-Host ('Locked by PID ' + $procId + ': ' + $procName + ' [' + $procPath + ']')

    if ($exclude -contains $procId) {
        Write-Host ('  -> skip PID ' + $procId + ': excluded')
        continue
    }
    if (-not $proc) {
        Write-Host ('  -> skip PID ' + $procId + ': process not found')
        continue
    }
    if (-not $proc.ExecutablePath) {
        Write-Host ('  -> skip PID ' + $procId + ': null ExecutablePath (protected/AV process), cannot match or kill')
        continue
    }
    if (-not (Test-TreeKillExecutablePathMatch -Proc $proc -Roots $roots -Exes $lockerExes)) {
        Write-Host ('  -> skip PID ' + $procId + ': ExecutablePath not under delete_folder and not a known locker exe')
        continue
    }

    Write-Host ('Killing PID ' + $procId + ' (Restart Manager): ' + $proc.ExecutablePath)
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
