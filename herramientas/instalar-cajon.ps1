<#
    Deja el cajón listo para que se abra solo al cobrar.

    Copia el script de apertura a una carpeta fija del usuario y registra en
    Windows el enlace "cajonreina:", de forma que la aplicación pueda pedir la
    apertura igual que una página pide abrir el correo con "mailto:".

    No hace falta ser administrador: todo se escribe en la parte del registro
    que pertenece al usuario. Para deshacerlo: instalar-cajon.ps1 -Quitar
#>

[CmdletBinding()]
param(
    [switch] $Quitar
)

$ErrorActionPreference = 'Stop'

$carpeta = Join-Path $env:LOCALAPPDATA 'CafeteriaReina'
$destino = Join-Path $carpeta 'abrir-cajon.ps1'
$clave = 'HKCU:\Software\Classes\cajonreina'

if ($Quitar) {
    if (Test-Path $clave) { Remove-Item $clave -Recurse -Force }
    Write-Host 'Quitado. La aplicacion ya no podra abrir el cajon.' -ForegroundColor Yellow
    exit 0
}

# --- Copiar el script a un sitio estable -----------------------------------
$origen = Join-Path $PSScriptRoot 'abrir-cajon.ps1'
if (-not (Test-Path $origen)) {
    Write-Host "No se encuentra abrir-cajon.ps1 junto a este archivo." -ForegroundColor Red
    Write-Host "Los dos tienen que estar en la misma carpeta."
    exit 1
}

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
Copy-Item $origen $destino -Force
Write-Host "Script copiado a: $destino"

# --- Registrar el enlace cajonreina: ---------------------------------------
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$orden = '"{0}" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{1}"' -f $powershell, $destino

New-Item -Path $clave -Force | Out-Null
Set-ItemProperty -Path $clave -Name '(Default)' -Value 'URL:Abrir el cajon de la Cafeteria Reina'
# Esta marca es la que le dice a Windows que esto es un tipo de enlace
Set-ItemProperty -Path $clave -Name 'URL Protocol' -Value ''

New-Item -Path "$clave\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$clave\shell\open\command" -Name '(Default)' -Value $orden

Write-Host ''
Write-Host 'Listo. El cajon ya se puede abrir desde la aplicacion.' -ForegroundColor Green
Write-Host ''
Write-Host 'Ahora, en la aplicacion:' -ForegroundColor Cyan
Write-Host '  1. Ajustes -> Impresora de tickets -> Cajon del dinero'
Write-Host '  2. Elige "Con el ayudante instalado"'
Write-Host '  3. Pulsa "Abrir el cajon ahora" para comprobarlo'
Write-Host ''
Write-Host 'La primera vez el navegador preguntara si permite abrir la aplicacion.'
Write-Host 'Marca la casilla de recordarlo y dile que si.'
