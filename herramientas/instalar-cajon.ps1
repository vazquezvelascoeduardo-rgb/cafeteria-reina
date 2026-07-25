<#
    Deja el cajón listo para que se abra solo al cobrar, y deprisa.

    Compila un programita de unos pocos kilobytes que manda el pulso a la
    impresora, y registra en Windows el enlace "cajonreina:" apuntando a él. La
    aplicación abre ese enlace igual que una página abre el correo con "mailto:".

    Se compila una sola vez, aquí, para que en el momento de cobrar no haya que
    arrancar PowerShell ni compilar nada: el cajón salta en cuanto se pulsa.

    No hace falta ser administrador. Para deshacerlo: instalar-cajon.ps1 -Quitar
#>

[CmdletBinding()]
param(
    [string] $Impresora,
    [switch] $Quitar
)

$ErrorActionPreference = 'Stop'

$carpeta = Join-Path $env:LOCALAPPDATA 'CafeteriaReina'
$exe = Join-Path $carpeta 'abrir-cajon.exe'
$fichaImpresora = Join-Path $carpeta 'impresora.txt'
$clave = 'HKCU:\Software\Classes\cajonreina'

if ($Quitar) {
    if (Test-Path $clave) { Remove-Item $clave -Recurse -Force }
    Write-Host 'Quitado. La aplicacion ya no podra abrir el cajon.' -ForegroundColor Yellow
    exit 0
}

# --- Buscar la impresora de tickets ----------------------------------------
if (-not $Impresora) {
    $patron = 'POS[- ]?\d{2}|XP[- ]?\d{2}|TM-|SRP-|thermal|receipt|ticket'
    $candidata = Get-Printer | Where-Object { $_.Name -match $patron -or $_.DriverName -match $patron } | Select-Object -First 1
    if ($candidata) { $Impresora = $candidata.Name }
}

if (-not $Impresora) {
    Write-Host 'No se ha encontrado ninguna impresora de tickets.' -ForegroundColor Yellow
    Write-Host 'Estas son las que hay instaladas:' -ForegroundColor Yellow
    Get-Printer | Format-Table Name, PortName, DriverName -AutoSize
    Write-Host 'Vuelve a ejecutarlo indicando el nombre exacto, por ejemplo:'
    Write-Host '   .\instalar-cajon.ps1 -Impresora "POS-80C"'
    exit 1
}

Write-Host "Impresora de tickets: $Impresora"

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
# El nombre va en un archivo aparte: si cambia la impresora, basta con editarlo
Set-Content -Path $fichaImpresora -Value $Impresora -Encoding UTF8

# --- Compilar el programa que abre el cajón --------------------------------
$codigo = @'
using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

public class AbrirCajon
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO pDocInfo);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int Main(string[] args)
    {
        try
        {
            string carpeta = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string ficha = Path.Combine(carpeta, "impresora.txt");
            string impresora = File.Exists(ficha) ? File.ReadAllText(ficha).Trim() : "";
            if (impresora.Length == 0) return 2;

            // ESC p 0 25 250: el pulso que abre el cajon
            byte[] pulso = new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA };

            IntPtr manejador;
            if (!OpenPrinter(impresora, out manejador, IntPtr.Zero)) return 3;

            try
            {
                DOCINFO info = new DOCINFO();
                info.pDocName = "Cajon";
                info.pDataType = "RAW";
                if (!StartDocPrinter(manejador, 1, ref info)) return 4;

                try
                {
                    if (!StartPagePrinter(manejador)) return 5;
                    IntPtr memoria = Marshal.AllocCoTaskMem(pulso.Length);
                    try
                    {
                        Marshal.Copy(pulso, 0, memoria, pulso.Length);
                        int escritos;
                        if (!WritePrinter(manejador, memoria, pulso.Length, out escritos)) return 6;
                    }
                    finally { Marshal.FreeCoTaskMem(memoria); }
                    EndPagePrinter(manejador);
                }
                finally { EndDocPrinter(manejador); }
            }
            finally { ClosePrinter(manejador); }

            return 0;
        }
        catch { return 1; }
    }
}
'@

Write-Host 'Compilando el programa (solo se hace ahora)...'
if (Test-Path $exe) { Remove-Item $exe -Force }

# WindowsApplication en vez de ConsoleApplication: asi no parpadea ninguna
# ventana negra cada vez que se abre el cajon
Add-Type -TypeDefinition $codigo -OutputAssembly $exe -OutputType WindowsApplication

if (-not (Test-Path $exe)) {
    Write-Host 'No se ha podido compilar el programa.' -ForegroundColor Red
    exit 1
}

Write-Host "Programa creado: $exe"

# --- Registrar el enlace cajonreina: ---------------------------------------
New-Item -Path $clave -Force | Out-Null
Set-ItemProperty -Path $clave -Name '(Default)' -Value 'URL:Abrir el cajon de la Cafeteria Reina'
Set-ItemProperty -Path $clave -Name 'URL Protocol' -Value ''

New-Item -Path "$clave\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$clave\shell\open\command" -Name '(Default)' -Value ('"{0}"' -f $exe)

# --- Comprobar que abre de verdad ------------------------------------------
Write-Host ''
Write-Host 'Probando...'
$reloj = [Diagnostics.Stopwatch]::StartNew()
$proceso = Start-Process -FilePath $exe -PassThru -Wait
$reloj.Stop()

if ($proceso.ExitCode -eq 0) {
    Write-Host ("El cajon deberia haberse abierto ({0} ms)." -f $reloj.ElapsedMilliseconds) -ForegroundColor Green
} else {
    Write-Host ("El programa ha devuelto el codigo {0}." -f $proceso.ExitCode) -ForegroundColor Yellow
    Write-Host 'Comprueba que la impresora esta encendida y bien puesta.'
}

Write-Host ''
Write-Host 'Listo. Ya se puede abrir el cajon desde la aplicacion.' -ForegroundColor Green
Write-Host 'La primera vez el navegador preguntara si permite abrirlo:'
Write-Host 'marca la casilla de recordarlo y dile que si.'
