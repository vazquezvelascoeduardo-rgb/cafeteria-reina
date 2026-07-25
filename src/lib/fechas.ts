/** Utilidades de fecha en horario local (nunca UTC, para que el cierre de caja cuadre) */

/** Date -> 'YYYY-MM-DD' en hora local */
export function aDiaLocal(fecha: Date = new Date()): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** '2026-07-25' -> '25/07/2026' */
export function formatearDia(dia: string): string {
  if (!dia) return ''
  const [y, m, d] = dia.split('-')
  return `${d}/${m}/${y}`
}

/** Timestamp -> '25/07/2026 18:42' */
export function formatearFechaHora(ts: number): string {
  const f = new Date(ts)
  return `${formatearDia(aDiaLocal(f))} ${String(f.getHours()).padStart(2, '0')}:${String(
    f.getMinutes(),
  ).padStart(2, '0')}`
}

/** Timestamp -> '18:42' */
export function formatearHora(ts: number): string {
  const f = new Date(ts)
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
}

/** Hace cuánto se abrió la mesa: '5 min', '1 h 20 min' */
export function tiempoTranscurrido(desde: number, ahora: number = Date.now()): string {
  const minutos = Math.max(0, Math.floor((ahora - desde) / 60000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/** Primer y último día del trimestre natural que contiene la fecha dada */
export function trimestreDe(fecha: Date = new Date()): { desde: string; hasta: string; etiqueta: string } {
  const trimestre = Math.floor(fecha.getMonth() / 3)
  const inicio = new Date(fecha.getFullYear(), trimestre * 3, 1)
  const fin = new Date(fecha.getFullYear(), trimestre * 3 + 3, 0)
  return {
    desde: aDiaLocal(inicio),
    hasta: aDiaLocal(fin),
    etiqueta: `${trimestre + 1}T ${fecha.getFullYear()}`,
  }
}

/** El trimestre natural anterior al que contiene la fecha dada */
export function trimestreAnterior(fecha: Date = new Date()): {
  desde: string
  hasta: string
  etiqueta: string
} {
  const trimestre = Math.floor(fecha.getMonth() / 3)
  const inicioActual = new Date(fecha.getFullYear(), trimestre * 3, 1)
  const unDiaAntes = new Date(inicioActual.getTime() - 86400000)
  return trimestreDe(unDiaAntes)
}

/** Nombre del mes: '2026-07' -> 'julio 2026' */
export function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const nombre = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
  return `${nombre} ${y}`
}

/** Devuelve los últimos N días como 'YYYY-MM-DD', del más antiguo al más reciente */
export function ultimosDias(n: number, hasta: Date = new Date()): string[] {
  const dias: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const f = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - i)
    dias.push(aDiaLocal(f))
  }
  return dias
}

/** Etiqueta corta para un día: 'lun 21' */
export function etiquetaDiaCorta(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  const semana = fecha.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')
  return `${semana} ${d}`
}
