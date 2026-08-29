param(
    [string]$Action,
    [string[]]$ProcessNames
)

$code = @"
using System;
using System.Runtime.InteropServices;
public class ProcessManager {
    [Flags]
    public enum ThreadAccess : int { SUSPEND_RESUME = 0x0002 }
    [DllImport("kernel32.dll")]
    static extern IntPtr OpenThread(ThreadAccess dwDesiredAccess, bool bInheritHandle, uint dwThreadId);
    [DllImport("kernel32.dll")]
    static extern uint SuspendThread(IntPtr hThread);
    [DllImport("kernel32.dll")]
    static extern uint ResumeThread(IntPtr hThread);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr hHandle);

    public static void Suspend(int pid) {
        try {
            var proc = System.Diagnostics.Process.GetProcessById(pid);
            foreach (System.Diagnostics.ProcessThread pT in proc.Threads) {
                IntPtr pOpenThread = OpenThread(ThreadAccess.SUSPEND_RESUME, false, (uint)pT.Id);
                if (pOpenThread == IntPtr.Zero) continue;
                SuspendThread(pOpenThread);
                CloseHandle(pOpenThread);
            }
        } catch {}
    }
    public static void Resume(int pid) {
        try {
            var proc = System.Diagnostics.Process.GetProcessById(pid);
            foreach (System.Diagnostics.ProcessThread pT in proc.Threads) {
                IntPtr pOpenThread = OpenThread(ThreadAccess.SUSPEND_RESUME, false, (uint)pT.Id);
                if (pOpenThread == IntPtr.Zero) continue;
                var suspendCount = 0;
                do { suspendCount = (int)ResumeThread(pOpenThread); } while (suspendCount > 0);
                CloseHandle(pOpenThread);
            }
        } catch {}
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp

foreach ($pName in $ProcessNames) {
    $procs = Get-Process -Name $pName -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        if ($Action -eq "suspend") {
            [ProcessManager]::Suspend($proc.Id)
        } elseif ($Action -eq "resume") {
            [ProcessManager]::Resume($proc.Id)
        }
    }
}
