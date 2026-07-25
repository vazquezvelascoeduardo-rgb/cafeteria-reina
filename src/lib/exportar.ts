import { db, type Ticket } from '../db'
import { formatearDia, formatearHora } from './fechas'

/**
 * Genera los archivos de Excel.
 *
 * Se usa CSV con punto y coma y coma decimal, que es el formato que Excel en
 * español abre de un doble clic sin preguntar nada. El BOM del principio es lo
 * que hace que las tildes y las eñes salgan bien.
 */

export type Hoja = { nombre: string; contenido: string }

const BOM = '﻿'

function celda(valor: string | number): string {
  const texto = String(valor)
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function comoCsv(cabeceras: string[], filas: (string | number)[][]): string {
  return BOM + [cabeceras, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n'
}

/** 460 -> "4,60" (Excel en español lo lee como número) */
function importe(centimos: number): string {
  return (centimos / 100).toFixed(2).replace('.', ',')
}

const NOMBRE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  cuenta: 'A cuenta',
}

function hojaResumenDiario(tickets: Ticket[]): Hoja {
  const porDia = new Map<string, { efectivo: number; tarjeta: number; cuenta: number; tickets: number }>()

  for (const t of tickets) {
    const dia = porDia.get(t.dia) ?? { efectivo: 0, tarjeta: 0, cuenta: 0, tickets: 0 }
    if (t.metodoPago === 'efectivo') dia.efectivo += t.total
    if (t.metodoPago === 'tarjeta') dia.tarjeta += t.total
    if (t.metodoPago === 'cuenta') dia.cuenta += t.total
    dia.tickets++
    porDia.set(t.dia, dia)
  }

  const filas = [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dia, d]) => [
      formatearDia(dia),
      d.tickets,
      importe(d.efectivo),
      importe(d.tarjeta),
      importe(d.cuenta),
      importe(d.efectivo + d.tarjeta),
      importe(d.efectivo + d.tarjeta + d.cuenta),
    ])

  return {
    nombre: 'resumen-por-dias.csv',
    contenido: comoCsv(
      ['Día', 'Tickets', 'Efectivo', 'Tarjeta', 'A cuenta', 'Cobrado', 'Total consumido'],
      filas,
    ),
  }
}

function hojaTickets(tickets: Ticket[]): Hoja {
  const filas = tickets
    .sort((a, b) => (a.cerradoEn ?? 0) - (b.cerradoEn ?? 0))
    .map((t) => [
      formatearDia(t.dia),
      t.cerradoEn ? formatearHora(t.cerradoEn) : '',
      t.mesaNombre,
      NOMBRE_PAGO[t.metodoPago ?? ''] ?? '',
      t.clienteNombre ?? '',
      t.lineas.reduce((s, l) => s + l.cantidad, 0),
      importe(t.total),
    ])

  return {
    nombre: 'tickets.csv',
    contenido: comoCsv(
      ['Día', 'Hora', 'Mesa', 'Forma de pago', 'Cliente', 'Artículos', 'Total'],
      filas,
    ),
  }
}

function hojaProductos(tickets: Ticket[]): Hoja {
  const filas: (string | number)[][] = []
  for (const t of tickets.sort((a, b) => (a.cerradoEn ?? 0) - (b.cerradoEn ?? 0))) {
    for (const l of t.lineas) {
      filas.push([
        formatearDia(t.dia),
        t.mesaNombre,
        l.nombre,
        l.cantidad,
        importe(l.precio),
        `${l.iva}%`,
        importe(l.precio * l.cantidad),
      ])
    }
  }

  return {
    nombre: 'detalle-de-consumos.csv',
    contenido: comoCsv(
      ['Día', 'Mesa', 'Producto', 'Unidades', 'Precio unidad', 'IVA', 'Importe'],
      filas,
    ),
  }
}

/** Cuánto se ha vendido de cada producto en total */
function hojaMasVendidos(tickets: Ticket[]): Hoja {
  const porProducto = new Map<string, { unidades: number; importe: number }>()
  for (const t of tickets) {
    for (const l of t.lineas) {
      const actual = porProducto.get(l.nombre) ?? { unidades: 0, importe: 0 }
      porProducto.set(l.nombre, {
        unidades: actual.unidades + l.cantidad,
        importe: actual.importe + l.precio * l.cantidad,
      })
    }
  }

  const filas = [...porProducto.entries()]
    .sort((a, b) => b[1].importe - a[1].importe)
    .map(([nombre, d]) => [nombre, d.unidades, importe(d.importe)])

  return {
    nombre: 'productos-mas-vendidos.csv',
    contenido: comoCsv(['Producto', 'Unidades vendidas', 'Total facturado'], filas),
  }
}

/** Periodo de fechas a exportar. Sin rango, se exporta todo el histórico */
export type Rango = { desde: string; hasta: string }

export async function generarHojas(rango?: Rango): Promise<Hoja[]> {
  const todos = await db.tickets.toArray()
  const tickets = todos
    .filter((t) => t.estado !== 'abierto')
    .filter((t) => !rango || (t.dia >= rango.desde && t.dia <= rango.hasta))

  const facturas = (await db.facturas.toArray()).filter(
    (f) => !rango || (f.fecha >= rango.desde && f.fecha <= rango.hasta),
  )

  const hojaFacturas: Hoja = {
    nombre: 'facturas-emitidas.csv',
    contenido: comoCsv(
      ['Número', 'Fecha', 'Cliente', 'NIF', 'Desde', 'Hasta', 'Base imponible', 'IVA', 'Total'],
      facturas
        .sort((a, b) => a.numero.localeCompare(b.numero))
        .map((f) => [
          f.numero,
          formatearDia(f.fecha),
          f.cliente.nombre,
          f.cliente.nif,
          formatearDia(f.desde),
          formatearDia(f.hasta),
          importe(f.base),
          importe(f.cuota),
          importe(f.total),
        ]),
    ),
  }

  return [
    hojaResumenDiario(tickets),
    hojaTickets(tickets),
    hojaProductos(tickets),
    hojaMasVendidos(tickets),
    hojaFacturas,
  ]
}

/** Descarga un archivo desde el navegador */
export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}
