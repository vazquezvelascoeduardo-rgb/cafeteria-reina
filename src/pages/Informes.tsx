import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db'
import { Tarjeta, Titulo, Vacio, claseInput } from '../components/ui'
import { formatearEuros } from '../lib/dinero'
import { aDiaLocal, etiquetaDiaCorta, formatearDia, nombreMes, ultimosDias } from '../lib/fechas'

type Rango = '7' | '30' | '90' | 'todo'

export function Informes() {
  const [rango, setRango] = useState<Rango>('30')

  const tickets = useLiveQuery(
    async () => (await db.tickets.toArray()).filter((t) => t.estado !== 'abierto'),
    [],
    [],
  )

  const desde = useMemo(() => {
    if (rango === 'todo') return '0000-00-00'
    const dias = Number(rango)
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (dias - 1))
    return aDiaLocal(inicio)
  }, [rango])

  const enRango = tickets.filter((t) => t.dia >= desde)

  const total = enRango.reduce((s, t) => s + t.total, 0)
  const efectivo = enRango.filter((t) => t.metodoPago === 'efectivo').reduce((s, t) => s + t.total, 0)
  const tarjeta = enRango.filter((t) => t.metodoPago === 'tarjeta').reduce((s, t) => s + t.total, 0)
  const cuenta = enRango.filter((t) => t.metodoPago === 'cuenta').reduce((s, t) => s + t.total, 0)
  const ticketMedio = enRango.length === 0 ? 0 : Math.round(total / enRango.length)

  // --- Ventas por día ---
  const porDia = new Map<string, number>()
  for (const t of enRango) porDia.set(t.dia, (porDia.get(t.dia) ?? 0) + t.total)

  const diasGrafico =
    rango === 'todo'
      ? [...porDia.keys()].sort().slice(-30)
      : ultimosDias(Math.min(Number(rango), 30))
  const maxDia = Math.max(1, ...diasGrafico.map((d) => porDia.get(d) ?? 0))

  // --- Ventas por mes ---
  const porMes = new Map<string, number>()
  for (const t of enRango) {
    const mes = t.dia.slice(0, 7)
    porMes.set(mes, (porMes.get(mes) ?? 0) + t.total)
  }
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)

  // --- Productos más vendidos ---
  const porProducto = new Map<string, { unidades: number; importe: number }>()
  for (const t of enRango) {
    for (const l of t.lineas) {
      const actual = porProducto.get(l.nombre) ?? { unidades: 0, importe: 0 }
      porProducto.set(l.nombre, {
        unidades: actual.unidades + l.cantidad,
        importe: actual.importe + l.precio * l.cantidad,
      })
    }
  }
  const topProductos = [...porProducto.entries()].sort((a, b) => b[1].importe - a[1].importe).slice(0, 15)
  const maxProducto = Math.max(1, ...topProductos.map(([, v]) => v.importe))

  // --- Días más fuertes de la semana ---
  const porDiaSemana = new Map<number, { total: number; dias: Set<string> }>()
  for (const [dia, importe] of porDia) {
    const [y, m, d] = dia.split('-').map(Number)
    const numero = new Date(y, m - 1, d).getDay()
    const actual = porDiaSemana.get(numero) ?? { total: 0, dias: new Set<string>() }
    actual.total += importe
    actual.dias.add(dia)
    porDiaSemana.set(numero, actual)
  }
  const NOMBRES_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const semana = [1, 2, 3, 4, 5, 6, 0].map((n) => {
    const datos = porDiaSemana.get(n)
    return {
      nombre: NOMBRES_SEMANA[n],
      media: datos && datos.dias.size > 0 ? Math.round(datos.total / datos.dias.size) : 0,
    }
  })
  const maxSemana = Math.max(1, ...semana.map((s) => s.media))

  return (
    <div>
      <Titulo
        extra={
          <select value={rango} onChange={(e) => setRango(e.target.value as Rango)} className={`${claseInput} w-52`}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="todo">Todo el histórico</option>
          </select>
        }
      >
        Informes
      </Titulo>

      {enRango.length === 0 ? (
        <Vacio>
          Todavía no hay ventas registradas en este periodo.
          <br />
          Cuando empieces a cobrar mesas, aquí verás cómo va el negocio.
        </Vacio>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Resumen titulo="Facturado" valor={formatearEuros(total)} destacado />
            <Resumen titulo="Efectivo" valor={formatearEuros(efectivo)} />
            <Resumen titulo="Tarjeta" valor={formatearEuros(tarjeta)} />
            <Resumen titulo="A cuenta" valor={formatearEuros(cuenta)} />
            <Resumen
              titulo="Ticket medio"
              valor={formatearEuros(ticketMedio)}
              nota={`${enRango.length} tickets`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Tarjeta>
              <h2 className="mb-4 text-lg font-bold text-cafe-900">Ventas por día</h2>
              <div className="flex h-52 items-end gap-1">
                {diasGrafico.map((dia) => {
                  const importe = porDia.get(dia) ?? 0
                  return (
                    <div key={dia} className="group relative flex flex-1 flex-col justify-end">
                      <div
                        className="rounded-t bg-cafe-500 transition-colors group-hover:bg-cafe-700"
                        style={{ height: `${Math.max(2, (importe / maxDia) * 100)}%` }}
                      />
                      <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg bg-cafe-900 px-2 py-1 text-xs font-bold whitespace-nowrap text-white group-hover:block">
                        {formatearDia(dia)}: {formatearEuros(importe)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-cafe-400">
                <span>{etiquetaDiaCorta(diasGrafico[0] ?? '')}</span>
                <span>{etiquetaDiaCorta(diasGrafico[diasGrafico.length - 1] ?? '')}</span>
              </div>
            </Tarjeta>

            <Tarjeta>
              <h2 className="mb-4 text-lg font-bold text-cafe-900">Media por día de la semana</h2>
              <div className="space-y-2">
                {semana.map((s) => (
                  <div key={s.nombre} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-cafe-600">{s.nombre}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-md bg-cafe-100">
                      <div
                        className="h-full rounded-md bg-cafe-400"
                        style={{ width: `${(s.media / maxSemana) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-cafe-800">
                      {formatearEuros(s.media)}
                    </span>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta>
              <h2 className="mb-4 text-lg font-bold text-cafe-900">Lo que más se vende</h2>
              <div className="space-y-2">
                {topProductos.map(([nombre, datos]) => (
                  <div key={nombre} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm text-cafe-700">{nombre}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-md bg-cafe-100">
                      <div
                        className="h-full rounded-md bg-emerald-500"
                        style={{ width: `${(datos.importe / maxProducto) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs text-cafe-500 tabular-nums">
                      {datos.unidades} u.
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-cafe-800">
                      {formatearEuros(datos.importe)}
                    </span>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta>
              <h2 className="mb-4 text-lg font-bold text-cafe-900">Resumen por meses</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-cafe-100">
                  {meses.map(([mes, importe]) => (
                    <tr key={mes}>
                      <td className="py-2.5 capitalize text-cafe-700">{nombreMes(mes)}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums text-cafe-900">
                        {formatearEuros(importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  )
}

function Resumen({
  titulo,
  valor,
  nota,
  destacado,
}: {
  titulo: string
  valor: string
  nota?: string
  destacado?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        destacado ? 'bg-cafe-600 text-white' : 'border border-cafe-200 bg-white text-cafe-900'
      }`}
    >
      <div className={`text-sm ${destacado ? 'opacity-80' : 'text-cafe-500'}`}>{titulo}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valor}</div>
      {nota && <div className={`mt-1 text-xs ${destacado ? 'opacity-80' : 'text-cafe-400'}`}>{nota}</div>}
    </div>
  )
}
