import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { BarraAcciones, Boton, Campo, Entrada, Etiqueta, Importe, Tarjeta, Vacio } from '../components/ui'
import { Calendario } from '../components/Calendario'
import { desglosePago, eurosACentimos, formatearEuros } from '../lib/dinero'
import { aDiaLocal, aMesLocal, formatearDia, formatearHora, rangoDeMes } from '../lib/fechas'
import { reabrirTicket } from '../lib/acciones'
import { descargar, generarHojas } from '../lib/exportar'
import { imprimirTicket } from '../lib/ticket'
import { abrirCajonComoToque } from '../lib/cajon'

export function Caja() {
  const [mes, setMes] = useState(() => aMesLocal())
  const [dia, setDia] = useState(() => aDiaLocal())
  const [contado, setContado] = useState('')

  const rango = rangoDeMes(mes)

  const ticketsDelMes = useLiveQuery(
    () => db.tickets.where('dia').between(rango.desde, rango.hasta, true, true).toArray(),
    [rango.desde, rango.hasta],
    [],
  )
  const tickets = useLiveQuery(() => db.tickets.where('dia').equals(dia).toArray(), [dia], [])
  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])

  const importesPorDia = new Map<string, number>()
  for (const t of ticketsDelMes) {
    importesPorDia.set(t.dia, (importesPorDia.get(t.dia) ?? 0) + t.total)
  }

  const aCuenta = tickets.filter((t) => t.estado === 'a_cuenta')

  const caja = tickets.reduce(
    (suma, t) => {
      const d = desglosePago(t)
      return {
        efectivo: suma.efectivo + d.efectivo,
        tarjeta: suma.tarjeta + d.tarjeta,
      }
    },
    { efectivo: 0, tarjeta: 0 },
  )
  const efectivo = caja.efectivo
  const tarjeta = caja.tarjeta
  const pendiente = aCuenta.reduce((s, t) => s + t.total, 0)

  const contadoCentimos = eurosACentimos(contado)
  const descuadre = contadoCentimos === null ? null : contadoCentimos - efectivo

  const esHoy = dia === aDiaLocal()
  const ordenados = [...tickets].sort((a, b) => (b.cerradoEn ?? 0) - (a.cerradoEn ?? 0))

  const descargarMes = async () => {
    const hojas = await generarHojas(rango)
    for (const hoja of hojas) {
      descargar(hoja.nombre.replace('.csv', `-${mes}.csv`), hoja.contenido)
    }
  }

  return (
    <div>
      <BarraAcciones>
        {!esHoy && (
          <Boton
            tono="neutro"
            onClick={() => {
              setDia(aDiaLocal())
              setMes(aMesLocal())
              setContado('')
            }}
          >
            ← Volver a hoy
          </Boton>
        )}
        {ajustes && (
          <Boton
            tono="neutro"
            onClick={() =>
              abrirCajonComoToque(ajustes).catch((e) =>
                alert(e instanceof Error ? e.message : 'No se ha podido abrir el cajón'),
              )
            }
          >
            Abrir el cajón
          </Boton>
        )}
      </BarraAcciones>

      {esHoy && abiertos.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <b>Atención:</b> quedan {abiertos.length}{' '}
          {abiertos.length === 1 ? 'mesa abierta' : 'mesas abiertas'} sin cobrar por{' '}
          {formatearEuros(abiertos.reduce((s, t) => s + t.total, 0))}. Ciérralas antes de cuadrar la caja.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <Tarjeta>
            <Calendario
              mes={mes}
              onCambiarMes={setMes}
              importesPorDia={importesPorDia}
              diaSeleccionado={dia}
              onSeleccionarDia={(d) => {
                setDia(d)
                setContado('')
              }}
            />
            <div className="mt-4 border-t border-cafe-100 pt-4">
              <Boton tono="neutro" onClick={descargarMes} className="w-full">
                Descargar este mes en Excel
              </Boton>
            </div>
          </Tarjeta>

          <Tarjeta className="mt-6">
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
        </div>

        <div>
          <h2 className="mb-4 font-serif text-2xl font-semibold">
            {esHoy ? 'Hoy' : formatearDia(dia)}
          </h2>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Dato titulo="Total cobrado" valor={formatearEuros(efectivo + tarjeta)} destacado />
            <Dato titulo="Efectivo" valor={formatearEuros(efectivo)} />
            <Dato titulo="Tarjeta" valor={formatearEuros(tarjeta)} />
            <Dato
              titulo="A cuenta (sin cobrar)"
              valor={formatearEuros(pendiente)}
              nota={`${aCuenta.length} ${aCuenta.length === 1 ? 'ticket' : 'tickets'}`}
            />
          </div>

          <h3 className="mb-3 font-bold text-cafe-900">Tickets ({tickets.length})</h3>
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
                        {t.pagos && t.pagos.length > 0 ? (
                          <Etiqueta tono="neutro">Dividido</Etiqueta>
                        ) : (
                          <>
                            {t.metodoPago === 'efectivo' && <Etiqueta tono="verde">Efectivo</Etiqueta>}
                            {t.metodoPago === 'tarjeta' && <Etiqueta tono="azul">Tarjeta</Etiqueta>}
                            {t.metodoPago === 'cuenta' && (
                              <Etiqueta tono="ambar">A cuenta · {t.clienteNombre}</Etiqueta>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        {formatearEuros(t.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {ajustes && t.estado === 'cobrado' && (
                          <button
                            onClick={() => imprimirTicket(t, ajustes)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-cafe-500 hover:bg-cafe-100 hover:text-cafe-800"
                          >
                            Imprimir
                          </button>
                        )}
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
        destacado ? 'bg-cafe-800 text-marfil' : 'border border-borde bg-white'
      }`}
    >
      <div className={`text-xs font-bold ${destacado ? 'text-[#D8BE93]' : 'text-cafe-500'}`}>
        {titulo}
      </div>
      {destacado ? (
        <Importe className="mt-1 block text-4xl">{valor}</Importe>
      ) : (
        <div className="mt-1 text-3xl font-extrabold tabular-nums">{valor}</div>
      )}
      {nota && (
        <div className={`mt-1 text-xs font-semibold ${destacado ? 'text-[#BFA57C]' : 'text-cafe-400'}`}>
          {nota}
        </div>
      )}
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
