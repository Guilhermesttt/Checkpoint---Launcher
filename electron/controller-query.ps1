# controller-query.ps1
# Consulta bateria e status de conexao de controles no Windows

$res = @{ battery = $null; isCharging = $false; type = "unknown"; name = $null }

# 1. Checa se ha controle Bluetooth Sony / Xbox conectado
try {
  $btDevs = Get-PnpDevice -Status 'OK' -ErrorAction SilentlyContinue | Where-Object {
    ($_.FriendlyName -match 'Wireless Controller|DualSense|DualShock|Xbox') -and
    ($_.Class -eq 'Bluetooth' -or $_.InstanceId -match 'BTHENUM|00001124')
  }
  
  $usbDevs = Get-PnpDevice -Class 'HIDClass' -Status 'OK' -ErrorAction SilentlyContinue | Where-Object {
    ($_.FriendlyName -match 'Wireless Controller|DualSense|DualShock|Xbox') -and
    ($_.InstanceId -notmatch '00001124|BTHENUM')
  }

  if ($usbDevs) {
    $res.type = "usb"
    $targetDev = $usbDevs | Select-Object -First 1
    $res.name = if ($targetDev.FriendlyName) { $targetDev.FriendlyName } else { "Controle USB" }
    $res.isCharging = $true
  } elseif ($btDevs) {
    $res.type = "bluetooth"
    $targetDev = $btDevs | Select-Object -First 1
    $res.name = if ($targetDev.FriendlyName) { $targetDev.FriendlyName } else { "Controle Bluetooth" }

    # 1.1 Checa propriedade Bluetooth nativa (para Xbox One/Series Bluetooth)
    foreach ($d in $btDevs) {
      try {
        $p = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName '{104ea319-6ee2-4701-bd47-8ddbf425bbe5} 2' -ErrorAction Stop
        if ($p -and $p.Data -ne $null -and [int]$p.Data -gt 0) {
          $res.battery = [int]$p.Data
          break
        }
      } catch {}
    }
  }
} catch {}

# 1.2 Leitor direto de bateria Sony HID (DualShock 4 / DualSense via hid.dll)
try {
  $sonyCode = @'
  using System;
  using System.Runtime.InteropServices;
  using Microsoft.Win32.SafeHandles;

  public class SonyHidReaderV5 {
    [DllImport("hid.dll", SetLastError = true)]
    public static extern void HidD_GetHidGuid(out Guid hidGuid);

    [DllImport("setupapi.dll", SetLastError = true)]
    public static extern IntPtr SetupDiGetClassDevs(ref Guid classGuid, IntPtr enumerator, IntPtr hwndParent, uint flags);

    [DllImport("setupapi.dll", SetLastError = true)]
    public static extern bool SetupDiEnumDeviceInterfaces(IntPtr hDevInfo, IntPtr devInfo, ref Guid interfaceClassGuid, uint memberIndex, ref SP_DEVICE_INTERFACE_DATA deviceInterfaceData);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr hDevInfo, ref SP_DEVICE_INTERFACE_DATA deviceInterfaceData, IntPtr deviceInterfaceDetailData, uint deviceInterfaceDetailDataSize, out uint requiredSize, IntPtr deviceInfoData);

    [DllImport("setupapi.dll", SetLastError = true)]
    public static extern bool SetupDiDestroyDeviceInfoList(IntPtr hDevInfo);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("hid.dll", SetLastError = true)]
    public static extern bool HidD_GetFeature(SafeFileHandle hidDeviceObject, byte[] lpReportBuffer, int reportBufferLength);

    [DllImport("hid.dll", SetLastError = true)]
    public static extern bool HidD_GetInputReport(SafeFileHandle hidDeviceObject, byte[] lpReportBuffer, int reportBufferLength);

    [StructLayout(LayoutKind.Sequential)]
    public struct SP_DEVICE_INTERFACE_DATA {
      public uint cbSize;
      public Guid interfaceClassGuid;
      public uint flags;
      public IntPtr reserved;
    }

    public static string ReadBattery() {
      Guid hidGuid;
      HidD_GetHidGuid(out hidGuid);
      IntPtr hDevInfo = SetupDiGetClassDevs(ref hidGuid, IntPtr.Zero, IntPtr.Zero, 0x10 | 0x02);
      if (hDevInfo == (IntPtr)(-1)) return "";

      SP_DEVICE_INTERFACE_DATA ifData = new SP_DEVICE_INTERFACE_DATA();
      ifData.cbSize = (uint)Marshal.SizeOf(ifData);

      for (uint i = 0; SetupDiEnumDeviceInterfaces(hDevInfo, IntPtr.Zero, ref hidGuid, i, ref ifData); i++) {
        uint reqSize;
        SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, IntPtr.Zero, 0, out reqSize, IntPtr.Zero);
        IntPtr detail = Marshal.AllocHGlobal((int)reqSize);
        Marshal.WriteInt32(detail, IntPtr.Size == 8 ? 8 : 4 + Marshal.SystemDefaultCharSize);

        if (SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, detail, reqSize, out reqSize, IntPtr.Zero)) {
          IntPtr pPath = new IntPtr(detail.ToInt64() + 4);
          string path = Marshal.PtrToStringAuto(pPath);
          Marshal.FreeHGlobal(detail);

          if (path.IndexOf("054c", StringComparison.OrdinalIgnoreCase) >= 0) {
            SafeFileHandle handle = CreateFile(path, 0x80000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
            if (!handle.IsInvalid) {
              bool isBt = path.IndexOf("00001124", StringComparison.OrdinalIgnoreCase) >= 0 || path.IndexOf("bth", StringComparison.OrdinalIgnoreCase) >= 0;
              byte[] report = new byte[128];
              bool ok = false;

              if (isBt) {
                // No Bluetooth do DS4, Report 0x11 tem 78 bytes e contem o status da bateria
                report[0] = 0x11;
                ok = HidD_GetInputReport(handle, report, 78);
                if (!ok) {
                  report[0] = 0x11;
                  ok = HidD_GetInputReport(handle, report, report.Length);
                }
                if (!ok) {
                  report[0] = 0x05;
                  ok = HidD_GetInputReport(handle, report, report.Length);
                }
              } else {
                // No cabo USB, GetFeature(2) fornece telemetria completa
                report[0] = 0x02;
                ok = HidD_GetFeature(handle, report, 64);
                if (!ok) {
                  report[0] = 0x01;
                  ok = HidD_GetInputReport(handle, report, 64);
                }
              }

              if (ok) {
                int batByte = -1;
                bool chg = !isBt;

                if (report[0] == 0x02 && report.Length > 35) {
                  batByte = report[35];
                  chg = true;
                } else if (report[0] == 0x11 && report.Length > 30) {
                  batByte = report[30];
                  chg = (report[30] & 0x10) != 0;
                } else if (report[0] == 0x05 && report.Length > 35) {
                  batByte = report[35];
                  chg = (report[35] & 0x10) != 0 || (report.Length > 36 && (report[36] & 0x10) != 0);
                } else if (!isBt && report.Length > 12) {
                  batByte = report[12];
                  chg = (report[12] & 0x10) != 0;
                }

                if (batByte >= 0) {
                  int raw = batByte & 0x0f;
                  int pct = (raw >= 10) ? 100 : Math.Min(100, Math.Max(0, raw * 10));
                  // Ignora 0% espúrio de reports não inicializados
                  if (pct > 0 || (isBt && (batByte & 0x10) != 0)) {
                    handle.Close();
                    SetupDiDestroyDeviceInfoList(hDevInfo);
                    return string.Format("{0}|{1}|{2}|DualShock 4", pct, chg, isBt ? "bluetooth" : "usb");
                  }
                }
              }
              handle.Close();
            }
          }
        } else {
          Marshal.FreeHGlobal(detail);
        }
      }
      SetupDiDestroyDeviceInfoList(hDevInfo);
      return "";
    }
  }
'@
  Add-Type -TypeDefinition $sonyCode -ErrorAction SilentlyContinue
  $sonyRes = [SonyHidReaderV5]::ReadBattery()
  if ($sonyRes) {
    $sp = $sonyRes.Split('|')
    $res.battery = [int]$sp[0]
    $res.isCharging = ($sp[1] -eq "True")
    $res.type = $sp[2]
    $res.name = $sp[3]
  }
} catch {}

if ($res.battery -ne $null) {
  Write-Output "$($res.battery)|$($res.isCharging)|$($res.type)|$($res.name)"
  exit 0
}

# 2. XInput fallback para Xbox / controles emulados (DS4Windows / ViGEm)
try {
  $xcode = @'
  using System;
  using System.Runtime.InteropServices;
  public class XI {
    [StructLayout(LayoutKind.Sequential)]
    public struct XINPUT_BATTERY_INFORMATION {
      public byte BatteryType;
      public byte BatteryLevel;
    }
    [DllImport("xinput1_4.dll")]
    public static extern int XInputGetBatteryInformation(int userIndex, byte devType, ref XINPUT_BATTERY_INFORMATION info);
    public static string Check() {
      for (int i = 0; i < 4; i++) {
        XINPUT_BATTERY_INFORMATION info = new XINPUT_BATTERY_INFORMATION();
        int r = XInputGetBatteryInformation(i, 0, ref info);
        if (r == 0 && info.BatteryType != 0) {
          return i + ":" + info.BatteryType + ":" + info.BatteryLevel;
        }
      }
      return "NONE";
    }
  }
'@
  Add-Type -TypeDefinition $xcode -ErrorAction SilentlyContinue
  $xi = [XI]::Check()
  if ($xi -ne "NONE") {
    $parts = $xi.Split(':')
    $bType = [int]$parts[1]
    $bLevel = [int]$parts[2]
    # Se ainda nao tinhamos a bateria ou tipo, usa XInput
    if ($res.battery -eq $null) {
      if ($bType -eq 1) {
        # Wired
        if ($res.type -eq "unknown") { $res.type = "usb" }
        $res.battery = 100
        $res.isCharging = $true
      } else {
        # Wireless
        if ($res.type -eq "unknown") { $res.type = "bluetooth" }
        if ($bLevel -eq 0) { $res.battery = 15 }
        elseif ($bLevel -eq 1) { $res.battery = 35 }
        elseif ($bLevel -eq 2) { $res.battery = 70 }
        else { $res.battery = 100 }
      }
    }
  }
} catch {}

Write-Output "$($res.battery)|$($res.isCharging)|$($res.type)|$($res.name)"
