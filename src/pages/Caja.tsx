import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { Boton, Campo, Entrada, Etiqueta, Tarjeta, Titulo, Vacio, claseInput } from '../components/ui'
import { eurosACentimos, formatearEuros } from '../lib/dinero'
import { aDiaLocal, formatearDia, formatearHora } from '../lib/fechas'
import { reabrirTicket } from '../lib/acciones'

export function Caja() {
  const [dia, setDia] = useState(() => aDiaLocal())
  const [contado, setContado] = useState('')

  const tickets = useLiveQuery(() => db.tickets.where('dia').equals(dia).toArray(), [dia], [])
  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])

  const cobrados = tickets.filter((t) => t.estado === 'cobrado')
  const aCuenta = tickets.filter((t) => t.estado === 'a_cuenta')

  const efectivo = cobrados.filter((t) => t.metodoPago === 'efectivo').reduce((s, t) => s + t.total, 0)
  const tarjeta = cobrados.filter((t) => t.metodoPago === 'tarjeta').reduce((s, t) => s + t.total, 0)
  const pendiente = aCuenta.reduce((s, t) => s + t.total, 0)
  const totalCobrado = efectivo + tarjeta

  const contadoCentimos = eurosACentimos(contado)
  const descuadre = contadoCentimos === null ? null : contadoCentimos - efectivo

  const esHoy = dia === aDiaLocal()
  const ordenados = [...tickets].sort((a, b) => (b.cerradoEn ?? 0) - (a.cerradoEn ?? 0))

  return (
    <div>
      <Titulo
        extra={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dia}
              max={aDiaLocal()}
              onChange={(e) => {
                setDia(e.target.value)
                setContado('')
              }}
              className={`${claseInput} w-44`}
            />
            {!esHoy && (
              <Boton tono="suave" onClick={() => setDia(aDiaLocal())}>
                Hoy
              </Boton>
            )}
          </div>
        }
      >
        Caja del {formatearDia(dia)}
      </Titulo>

      {esHoy && abiertos.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <b>Atención:</b> quedan {abiertos.length}{' '}
          {abiertos.length === 1 ? 'mesa abierta' : 'mesas abiertas'} sin cobrar por{' '}
          {formatearEuros(abiertos.reduce((s, t) => s + t.total, 0))}. Ciérralas antes de cuadrar la caja.
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Dato titulo="Total cobrado" valor={formatearEuros(totalCobrado)} destacado />
        <Dato titulo="Efectivo" valor={formatearEuros(efectivo)} />
        <Dato titulo="Tarjeta" valor={formatearEuros(tarjeta)} />
        <Dato
          titulo="A cuenta (sin cobrar)"
          valor={formatearEuros(pendiente)}
          nota={`${aCuenta.length} ${aCuenta.length === 1 ? 'ticket' : 'tickets'}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Tarjeta>
          <h2 className="mb-1 text-lg font-bold text-cafe-900">Cuadrar el efectivo</h2>
          <p className="mb-4 text-sm text-cafe-500">
            Cuenta el dinero del cajón (sin el cambio inicial) y escríbelo aquí.
          </p>

          <Campo etiqueta="Dinero contado en el cajón (€)">
            <Entrada
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="!text-2xl !font-bold"
            />
          </Campo>

          <div className="mt-4 space-y-2 text-sm">
            <Fila etiqueta="Debería haber" valor={formatearEuros(efectivo)} />
            {contadoCentimos !== null && (
              <Fila etiqueta="Has contado" valor={formatearEuros(contadoCentimos)} />
            )}
          </div>

          {descuadre !== null && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-center ${
                descuadre === 0
                  ? 'bg-emerald-100 text-emerald-900'
                  : Math.abs(descuadre) <= 100
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-red-100 text-red-900'
              }`}
            >
              {descuadre === 0 ? (
                <span className="text-lg font-bold">La caja cuadra perfecta</span>
              ) : (
                <>
                  <div className="text-sm font-semibold">
                    {descuadre > 0 ? 'Sobra dinero' : 'Falta dinero'}
                  </div>
                  <div className="text-3xl font-bold tabular-nums">
                    {formatearEuros(Math.abs(descuadre))}
                  </div>
                </>
              )}
            </div>
          )}
        </Tarjeta>

        <div>
          <h2 className="mb-3 text-lg font-bold text-cafe-900">
            Tickets del día ({tickets.length})
          </h2>
          {ordenados.length === 0 ? (
            <Vacio>No hay ningún ticket cobrado este día.</Vacio>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-cafe-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-cafe-100 text-left text-xs tracking-wide text-cafe-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Hora</th>
                    <th className="px-4 py-2.5 font-bold">Mesa</th>
                    <th className="px-4 py-2.5 font-bold">Pago</th>
                    <th className="px-4 py-2.5 text-right font-bold">Importe</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cafe-100">
                  {ordenados.map((t) => (
                    <tr key={t.id} className="hover:bg-cafe-50">
                      <td className="px-4 py-2.5 tabular-nums">
                        {t.cerradoEn ? formatearHora(t.cerradoEn) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-cafe-900">{t.mesaNombre}</td>
                      <td className="px-4 py-2.5">
                        {t.metodoPago === 'efectivo' && <Etiqueta tono="verde">Efectivo</Etiqueta>}
                        {t.metodoPago === 'tarjeta' && <Etiqueta tono="azul">Tarjeta</Etiqueta>}
                        {t.metodoPago === 'cuenta' && (
                          <Etiqueta tono="ambar">A cuenta · {t.clienteNombre}</Etiqueta>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        {formatearEuros(t.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {t.facturaId === null ? (
                          <button
                            onClick={() => {
                              if (confirm('¿Deshacer este cobro? La mesa volverá a quedar abierta.')) {
                                reabrirTicket(t.id!)
                              }
                            }}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-cafe-500 hover:bg-cafe-100 hover:text-cafe-800"
                          >
                            Deshacer
                          </button>
                        ) : (
                          <span className="text-xs text-cafe-300">facturado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Dato({
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
      <div className="mt-1 text-3xl font-bold tabular-nums">{valor}</div>
      {nota && <div className={`mt-1 text-xs ${destacado ? 'opacity-80' : 'text-cafe-400'}`}>{nota}</div>}
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-cafe-200 pb-2">
      <span className="text-cafe-600">{etiqueta}</span>
      <span className="font-bold tabular-nums text-cafe-900">{valor}</span>
    </div>
  )
}
