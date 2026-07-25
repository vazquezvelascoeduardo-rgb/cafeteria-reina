import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Ticket } from '../db'
import { BarraAcciones, Boton, Entrada, Etiqueta, Importe, Modal, Vacio, claseInput } from '../components/ui'
import { desgloseCompleto, formatearEuros, formatearNumero, totalLinea } from '../lib/dinero'
import { aDiaLocal, formatearDia, formatearHora, rangoDeMes, aMesLocal } from '../lib/fechas'
import { imprimirTicket } from '../lib/ticket'
import { reabrirTicket } from '../lib/acciones'

type Filtro = 'todos' | 'efectivo' | 'tarjeta' | 'cuenta'

const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'cuenta', nombre: 'A cuenta' },
]

export function Tickets() {
  const mesActual = rangoDeMes(aMesLocal())
  const [desde, setDesde] = useState(mesActual.desde)
  const [hasta, setHasta] = useState(() => aDiaLocal())
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [viendo, setViendo] = useState<Ticket | null>(null)

  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])
  const tickets = useLiveQuery(
    () => db.tickets.where('dia').between(desde, hasta, true, true).toArray(),
    [desde, hasta],
    [],
  )

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return tickets
      .filter((t) => t.estado !== 'abierto')
      .filter((t) => filtro === 'todos' || t.metodoPago === filtro)
      .filter(
        (t) =>
          texto === '' ||
          (t.numero ?? '').toLowerCase().includes(texto) ||
          t.mesaNombre.toLowerCase().includes(texto) ||
          (t.clienteNombre ?? '').toLowerCase().includes(texto) ||
          t.lineas.some((l) => l.nombre.toLowerCase().includes(texto)),
      )
      .sort((a, b) => (b.cerradoEn ?? 0) - (a.cerradoEn ?? 0))
  }, [tickets, filtro, busqueda])

  const total = visibles.reduce((s, t) => s + t.total, 0)

  return (
    <div>
      <BarraAcciones>
        <div className="flex items-center gap-2">
          <Entrada
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            className="!w-44"
          />
          <span className="text-sm font-bold text-cafe-400">a</span>
          <Entrada
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            className="!w-44"
          />
        </div>

        <div className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                filtro === f.id
                  ? 'bg-cafe-800 text-marfil'
                  : 'border border-borde bg-white text-cafe-600 hover:bg-cafe-100'
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, mesa o producto…"
          className={`${claseInput} ml-auto max-w-72`}
        />
      </BarraAcciones>

      <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-sm font-bold text-cafe-500">
          {visibles.length} {visibles.length === 1 ? 'ticket' : 'tickets'}
        </span>
        <Importe className="text-2xl">{formatearEuros(total)}</Importe>
      </div>

      {visibles.length === 0 ? (
        <Vacio>
          No hay tickets con esos filtros.
          <br />
          Prueba a ampliar las fechas.
        </Vacio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cafe-100 text-left text-xs tracking-wide text-cafe-600 uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">Número</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Mesa</th>
                <th className="px-4 py-3 font-bold">Artículos</th>
                <th className="px-4 py-3 font-bold">Pago</th>
                <th className="px-4 py-3 text-right font-bold">Importe</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EBDD]">
              {visibles.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setViendo(t)}
                  className="cursor-pointer hover:bg-cafe-50"
                >
                  <td className="px-4 py-2.5 font-bold whitespace-nowrap">{t.numero ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {formatearDia(t.dia)} {t.cerradoEn ? formatearHora(t.cerradoEn) : ''}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{t.mesaNombre}</td>
                  <td className="px-4 py-2.5 text-cafe-500">
                    {t.lineas.reduce((s, l) => s + l.cantidad, 0)}
                  </td>
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
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {ajustes && t.estado === 'cobrado' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          imprimirTicket(t, ajustes)
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-bold text-cafe-500 hover:bg-cafe-100 hover:text-cafe-900"
                      >
                        Imprimir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalTicket ticket={viendo} onCerrar={() => setViendo(null)} />
    </div>
  )
}

function ModalTicket({ ticket, onCerrar }: { ticket: Ticket | null; onCerrar: () => void }) {
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])
  if (!ticket) return null

  const desglose = desgloseCompleto(
    ticket.lineas.map((l) => ({ iva: l.iva, importe: totalLinea(l) })),
  )

  return (
    <Modal abierto={true} onCerrar={onCerrar} titulo={ticket.numero ?? 'Ticket'}>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold text-cafe-500">
        <span>
          {formatearDia(ticket.dia)}
          {ticket.cerradoEn ? ` · ${formatearHora(ticket.cerradoEn)}` : ''}
        </span>
        <span>{ticket.mesaNombre}</span>
        {ticket.clienteNombre && <span>{ticket.clienteNombre}</span>}
      </div>

      <ul className="mb-3 overflow-hidden rounded-xl border border-borde bg-white">
        {ticket.lineas.map((l, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-[#F4EBDD] px-4 py-2 last:border-0">
            <span className="w-7 font-bold tabular-nums">{l.cantidad}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{l.nombre}</span>
            <span className="text-xs text-cafe-400">IVA {l.iva} %</span>
            <span className="w-20 text-right font-bold tabular-nums">
              {formatearEuros(totalLinea(l))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mb-4 rounded-xl bg-cafe-100 px-4 py-3">
        <div className="flex items-end justify-between">
          <span className="text-xs font-extrabold tracking-widest text-cafe-500 uppercase">Total</span>
          <Importe className="text-3xl">{formatearEuros(ticket.total)}</Importe>
        </div>
        <table className="mt-2 w-full text-xs text-cafe-600">
          <tbody>
            {desglose.map((d) => (
              <tr key={d.iva}>
                <td>IVA {d.iva} % incluido</td>
                <td className="text-right tabular-nums">base {formatearNumero(d.base)}</td>
                <td className="text-right tabular-nums">cuota {formatearNumero(d.cuota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ticket.metodoPago === 'efectivo' && ticket.recibido !== null && (
          <div className="mt-2 flex gap-4 text-xs font-semibold text-cafe-600">
            <span>Entregado {formatearEuros(ticket.recibido)}</span>
            <span>Cambio {formatearEuros(ticket.cambio ?? 0)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ajustes && ticket.estado === 'cobrado' && (
          <Boton tono="principal" onClick={() => imprimirTicket(ticket, ajustes)}>
            Imprimir de nuevo
          </Boton>
        )}
        {ticket.facturaId === null && (
          <Boton
            tono="neutro"
            className="!text-anular"
            onClick={() => {
              if (confirm('¿Deshacer este cobro? La mesa volverá a quedar abierta.')) {
                reabrirTicket(ticket.id!)
                onCerrar()
              }
            }}
          >
            Deshacer el cobro
          </Boton>
        )}
        <Boton tono="neutro" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </Modal>
  )
}
