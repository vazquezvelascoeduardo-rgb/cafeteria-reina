import type { Ajustes, Ticket } from '../db'
import { desgloseCompleto, formatearNumero, totalLinea } from './dinero'
import { formatearDia, formatearHora } from './fechas'

/**
 * El ticket en papel.
 *
 * Se monta como una página independiente dentro de un marco oculto y se manda a
 * imprimir desde ahí. Así el tamaño del papel (80 mm de ancho y alto libre) no
 * pelea con el de las facturas en A4, y los estilos de la aplicación no se
 * cuelan en el papel.
 *
 * Vale para cualquier impresora que tenga su controlador instalado en Windows,
 * que es el caso de todas las térmicas de ticket que se venden.
 */

/**
 * La corona del logo, en negro macizo.
 * El papel térmico solo imprime negro: los degradados dorados saldrían grises.
 */
const CORONA_SVG = `<svg class="corona" viewBox="-4 -18 108 102" xmlns="http://www.w3.org/2000/svg">
  <g fill="#000">
    <path d="M10 24 L22 60 H78 L90 24 L72 41 L50 13 L28 41 Z"/>
    <circle cx="10" cy="20" r="4.6"/>
    <circle cx="90" cy="20" r="4.6"/>
    <circle cx="50" cy="9" r="4.2"/>
    <rect x="47.2" y="-16" width="5.6" height="18" rx="2.4"/>
    <rect x="41.5" y="-10.5" width="17" height="5.2" rx="2.4"/>
    <rect x="12" y="64" width="76" height="14" rx="4.5"/>
  </g>
  <g fill="#fff">
    <circle cx="30" cy="71" r="2.5"/>
    <circle cx="50" cy="71" r="2.5"/>
    <circle cx="70" cy="71" r="2.5"/>
  </g>
</svg>`

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NOMBRE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  cuenta: 'A cuenta',
}

export function htmlDelTicket(ticket: Ticket, ajustes: Ajustes): string {
  const { emisor } = ajustes
  const ancho = ajustes.anchoTicket === 58 ? 58 : 80

  const desglose = desgloseCompleto(
    ticket.lineas.map((l) => ({ iva: l.iva, importe: totalLinea(l) })),
  )

  const lineas = ticket.lineas
    .map(
      (l) => `
      <tr>
        <td class="uds">${l.cantidad}</td>
        <td>${escapar(l.nombre)}${
          l.cantidad > 1 ? `<div class="unit">${formatearNumero(l.precio)} c/u</div>` : ''
        }</td>
        <td class="imp">${formatearNumero(totalLinea(l))}</td>
      </tr>`,
    )
    .join('')

  const impuestos = desglose
    .map(
      (d) =>
        `<tr><td>IVA ${d.iva} %</td><td class="imp">${formatearNumero(d.base)}</td><td class="imp">${formatearNumero(d.cuota)}</td></tr>`,
    )
    .join('')

  const efectivo =
    ticket.metodoPago === 'efectivo' && ticket.recibido !== null
      ? `<div class="fila"><span>Entregado</span><span>${formatearNumero(ticket.recibido)}</span></div>
         <div class="fila"><span>Cambio</span><span>${formatearNumero(ticket.cambio ?? 0)}</span></div>`
      : ''

  const cuando = ticket.cerradoEn ?? Date.now()

  // El logo que haya subido; si no hay ninguno, la corona dibujada
  const logo =
    ajustes.mostrarLogoTicket !== 1
      ? ''
      : ajustes.logoTicket
        ? `<img class="logo" src="${ajustes.logoTicket}" alt="">`
        : CORONA_SVG

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Ticket ${escapar(ticket.numero ?? '')}</title>
<style>
  @page { size: ${ancho}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 4mm 3mm 8mm;
    width: ${ancho}mm;
    font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  .centro { text-align: center; }
  .logo { display: block; margin: 0 auto 1.5mm; max-width: 46mm; max-height: 22mm; }
  .corona { display: block; margin: 0 auto 1mm; width: 13mm; }
  .negocio { font-size: 15px; font-weight: 800; letter-spacing: .02em; }
  .datos { font-size: 10px; }
  .raya { border-top: 1px dashed #000; margin: 2.5mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: .6mm 0; }
  .uds { width: 7mm; font-weight: 700; }
  .imp { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .unit { font-size: 9px; color: #444; }
  .fila { display: flex; justify-content: space-between; }
  .total { font-size: 17px; font-weight: 800; }
  .impuestos { font-size: 9.5px; }
  .impuestos td { padding: .3mm 0; }
  .pie { margin-top: 3mm; font-size: 10px; }
</style>
</head>
<body>
  <div class="centro">
    ${logo}
    <div class="negocio">${escapar(emisor.nombre || 'Cafetería Reina')}</div>
    <div class="datos">
      ${emisor.nif ? `NIF: ${escapar(emisor.nif)}<br>` : ''}
      ${emisor.direccion ? `${escapar(emisor.direccion)}<br>` : ''}
      ${emisor.cp || emisor.ciudad ? `${escapar(emisor.cp)} ${escapar(emisor.ciudad)}<br>` : ''}
      ${emisor.telefono ? `Tel. ${escapar(emisor.telefono)}` : ''}
    </div>
  </div>

  <div class="raya"></div>

  <div class="fila"><span>${formatearDia(ticket.dia)} ${formatearHora(cuando)}</span><span>${escapar(ticket.mesaNombre)}</span></div>
  ${ticket.numero ? `<div class="fila"><span>Ticket</span><span>${escapar(ticket.numero)}</span></div>` : ''}

  <div class="raya"></div>

  <table>${lineas}</table>

  <div class="raya"></div>

  <div class="fila total"><span>TOTAL</span><span>${formatearNumero(ticket.total)} €</span></div>
  <div class="fila"><span>${NOMBRE_PAGO[ticket.metodoPago ?? ''] ?? ''}</span><span></span></div>
  ${efectivo}

  <div class="raya"></div>

  <table class="impuestos">
    <tr><td><b>IVA incluido</b></td><td class="imp"><b>Base</b></td><td class="imp"><b>Cuota</b></td></tr>
    ${impuestos}
  </table>

  <div class="centro pie">
    ${ajustes.pieTicket ? `${escapar(ajustes.pieTicket)}<br>` : ''}
    <span style="font-size:9px">Factura simplificada</span>
  </div>
</body>
</html>`
}

/**
 * Manda el ticket a la impresora.
 *
 * Sale el cuadro de impresión de Windows. Para que no salga y el papel se
 * imprima directo, hay que abrir la aplicación con la opción --kiosk-printing
 * (está explicado en Ajustes → Impresora).
 */
export function imprimirTicket(ticket: Ticket, ajustes: Ajustes) {
  const marco = document.createElement('iframe')
  marco.setAttribute('aria-hidden', 'true')
  marco.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; opacity:0'
  document.body.appendChild(marco)

  const documento = marco.contentDocument
  if (!documento) {
    marco.remove()
    return
  }

  documento.open()
  documento.write(htmlDelTicket(ticket, ajustes))
  documento.close()

  // Hay que esperar a que el marco termine de montar la página o se imprime en blanco
  const lanzar = () => {
    marco.contentWindow?.focus()
    marco.contentWindow?.print()
    setTimeout(() => marco.remove(), 60000)
  }

  if (documento.readyState === 'complete') setTimeout(lanzar, 60)
  else marco.onload = lanzar
}
