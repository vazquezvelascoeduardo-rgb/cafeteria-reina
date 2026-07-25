import type { DesgloseIva, LineaTicket } from '../db'

/**
 * Todo el dinero circula en CÉNTIMOS enteros.
 * Estas funciones son la única puerta de entrada y salida a euros.
 */

const formateador = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
})

const formateadorSinSimbolo = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 1250 -> "12,50 €" */
export function formatearEuros(centimos: number): string {
  return formateador.format(centimos / 100)
}

/** 1250 -> "12,50" */
export function formatearNumero(centimos: number): string {
  return formateadorSinSimbolo.format(centimos / 100)
}

/** "12,50" o "12.50" -> 1250. Devuelve null si no es un número válido */
export function eurosACentimos(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (limpio === '') return null
  const valor = Number(limpio)
  if (!Number.isFinite(valor)) return null
  return Math.round(valor * 100)
}

/** Total de una línea (precio unitario x cantidad) */
export function totalLinea(linea: LineaTicket): number {
  return linea.precio * linea.cantidad
}

/** Total de un ticket entero */
export function totalLineas(lineas: LineaTicket[]): number {
  return lineas.reduce((suma, l) => suma + totalLinea(l), 0)
}

/**
 * Separa un importe con IVA incluido en base imponible + cuota.
 * Se calcula sobre el total del grupo de IVA, no línea a línea,
 * que es como lo hace una factura correcta (evita descuadres de 1 céntimo).
 */
export function desglosarIva(totalConIva: number, porcentajeIva: number): { base: number; cuota: number } {
  const base = Math.round((totalConIva * 100) / (100 + porcentajeIva))
  return { base, cuota: totalConIva - base }
}

/** Agrupa líneas por tipo de IVA y devuelve el desglose fiscal ordenado */
export function desgloseCompleto(lineas: { iva: number; importe: number }[]): DesgloseIva[] {
  const porTipo = new Map<number, number>()
  for (const l of lineas) {
    porTipo.set(l.iva, (porTipo.get(l.iva) ?? 0) + l.importe)
  }
  return [...porTipo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([iva, total]) => ({ iva, ...desglosarIva(total, iva) }))
}

/** Billetes y monedas de euro, de mayor a menor, en céntimos */
export const DENOMINACIONES = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

/**
 * Sugiere importes redondos con los que el cliente podría pagar.
 * Para 7,40 € sugiere 10 €, 20 €, 50 €...
 */
export function sugerenciasPago(total: number): number[] {
  if (total <= 0) return []
  const candidatos = new Set<number>()
  candidatos.add(total)

  // Redondeo al euro, a los 5 y a los 10 siguientes
  for (const paso of [100, 500, 1000, 2000]) {
    const redondeado = Math.ceil(total / paso) * paso
    if (redondeado > total) candidatos.add(redondeado)
  }
  // Billetes habituales por encima del total
  for (const billete of [500, 1000, 2000, 5000]) {
    if (billete > total) candidatos.add(billete)
  }

  return [...candidatos].sort((a, b) => a - b).slice(0, 5)
}

/** Desglosa el cambio en billetes y monedas: "1 de 5 €, 2 de 1 €, 1 de 50 cts" */
export function desglosarCambio(cambio: number): { valor: number; unidades: number }[] {
  const resultado: { valor: number; unidades: number }[] = []
  let resto = cambio
  for (const valor of DENOMINACIONES) {
    const unidades = Math.floor(resto / valor)
    if (unidades > 0) {
      resultado.push({ valor, unidades })
      resto -= unidades * valor
    }
  }
  return resultado
}
