<#
    Abre el cajón portamonedas enchufado a la impresora de tickets.

    Manda a la impresora el comando de toda la vida para dar el pulso al cajón
    (ESC p 0 25 250), como un trabajo de impresión en crudo. Al ir por la cola de
    impresión de Windows, funciona con impresoras USB, de red o de puerto serie,
    sin depender de las opciones que traiga el controlador.

    Uso:
        .\abrir-cajon.ps1                      -> busca la impresora de tickets
        .\abrir-cajon.ps1 -Listar              -> solo enseña las impresoras
        .\abrir-cajon.ps1 -Impresora "POS-80C" -> usa esa impresora
#>

[CmdletBinding()]
param(
    [string] $Impresora,
    [switch] $Listar
)

$ErrorActionPreference = 'Stop'

function Get-ImpresoraDeTickets {
    $todas = Get-Printer
    # Las de tickets suelen llamarse POS-80, XP-80, TM-, SRP-, Thermal...
    $patron = 'POS[- ]?\d{2}|XP[- ]?\d{2}|TM-|SRP-|thermal|receipt|ticket'
    $candidatas = $todas | Where-Object { $_.Name -match $patron -or $_.DriverName -match $patron }
    if ($candidatas) { return $candidatas[0].Name }
    return $null
}

if ($Listar) {
    Get-Printer | Format-Table Name, PortName, DriverName -AutoSize
    exit 0
}

if (-not $Impresora) {
    $Impresora = Get-ImpresoraDeTickets
    if (-not $Impresora) {
        Write-Host "No se ha encontrado ninguna impresora de tickets." -ForegroundColor Yellow
        Write-Host "Estas son las que hay instaladas:" -ForegroundColor Yellow
        Get-Printer | Format-Table Name, PortName, DriverName -AutoSize
        Write-Host 'Vuelve a ejecutarlo indicando el nombre exacto, por ejemplo:'
        Write-Host '   .\abrir-cajon.ps1 -Impresora "POS-80C"'
        exit 1
    }
}

Write-Host "Impresora: $Impresora"

# Envío en crudo a la cola de impresión, a través de la API de Windows
$codigo = @'
using System;
using System.Runtime.InteropServices;

public class ColaDeImpresion
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO
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

    public static void Enviar(string impresora, byte[] datos)
    {
        IntPtr manejador;
        if (!OpenPrinter(impresora, out manejador, IntPtr.Zero))
            throw new Exception("No se ha podido abrir la impresora (codigo " + Marshal.GetLastWin32Error() + ")");

        try
        {
            DOCINFO info = new DOCINFO();
            info.pDocName = "Apertura del cajon";
            info.pDataType = "RAW";

            if (!StartDocPrinter(manejador, 1, ref info))
                throw new Exception("La impresora no ha aceptado el trabajo (codigo " + Marshal.GetLastWin32Error() + ")");

            try
            {
                if (!StartPagePrinter(manejador))
                    throw new Exception("No se ha podido empezar la pagina");

                IntPtr memoria = Marshal.AllocCoTaskMem(datos.Length);
                try
                {
                    Marshal.Copy(datos, 0, memoria, datos.Length);
                    int escritos;
                    if (!WritePrinter(manejador, memoria, datos.Length, out escritos))
                        throw new Exception("No se ha podido enviar el comando");
                }
                finally { Marshal.FreeCoTaskMem(memoria); }

                EndPagePrinter(manejador);
            }
            finally { EndDocPrinter(manejador); }
        }
        finally { ClosePrinter(manejador); }
    }
}
'@

if (-not ('ColaDeImpresion' -as [type])) {
    Add-Type -TypeDefinition $codigo -Language CSharp
}

# ESC p 0 25 250: el pulso que abre el cajon
$pulso = [byte[]] @(0x1B, 0x70, 0x00, 0x19, 0xFA)

try {
    [ColaDeImpresion]::Enviar($Impresora, $pulso)
    Write-Host "Orden enviada. El cajon deberia haberse abierto." -ForegroundColor Green
}
catch {
    Write-Host "No se ha podido: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
