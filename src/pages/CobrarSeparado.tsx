import { useState } from 'react'
import type { Pago, Ticket } from '../db'
import { Boton, Importe, Modal, Vacio } from '../components/ui'
import { formatearEuros, repartirEnPartes, totalLinea } from '../lib/dinero'
import type { Seleccion } from '../lib/acciones'

type Modo = 'iguales' | 'suyo'

/**
 * Repartir la cuenta entre varios.
 *
 * Son dos cosas distintas y por eso van separadas:
 *  - A partes iguales: se divide el total y cada uno paga como quiera. Sale un
 *    solo ticket, con el detalle de la mesa entero.
 *  - Cada uno lo suyo: se marca lo que ha tomado esa persona, se le cobra y su
 *    parte se convierte en un ticket propio. Lo demás sigue en la mesa.
 */
export function CobrarSeparado({
  abierto,
  ticket,
  onCerrar,
  onCobrarIguales,
  onCobrarLoSuyo,
}: {
  abierto: boolean
  ticket: Ticket
  onCerrar: () => void
  onCobrarIguales: (pagos: Pago[]) => void
  onCobrarLoSuyo: (seleccion: Seleccion, total: number) => void
}) {
  const [modo, setModo] = useState<Modo>('iguales')

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Cobrar por separado" ancho="max-w-3xl">
      <div className="mb-4 flex gap-2">
        <BotonModo activo={modo === 'iguales'} onClick={() => setModo('iguales')}>
          A partes iguales
        </BotonModo>
        <BotonModo activo={modo === 'suyo'} onClick={() => setModo('suyo')}>
          Cada uno lo suyo
        </BotonModo>
      </div>

      {modo === 'iguales' ? (
        <PartesIguales total={ticket.total} onCobrar={onCobrarIguales} />
      ) : (
        <CadaUnoLoSuyo ticket={ticket} onCobrar={onCobrarLoSuyo} />
      )}
    </Modal>
  )
}

function BotonModo({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-4 py-3 text-[15px] font-bold transition-colors ${
        activo ? 'bg-cafe-800 text-marfil' : 'border border-borde bg-white text-cafe-600 hover:bg-cafe-100'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------

function PartesIguales({ total, onCobrar }: { total: number; onCobrar: (pagos: Pago[]) => void }) {
  const [personas, setPersonas] = useState(2)
  // Qué ha pagado cada uno; null = todavía no ha pagado
  const [pagado, setPagado] = useState<(Pago['metodo'] | null)[]>(() => Array(2).fill(null))

  const importes = repartirEnPartes(total, personas)
  const faltan = pagado.filter((p) => p === null).length
  const cobrado = importes.reduce((s, importe, i) => s + (pagado[i] ? importe : 0), 0)

  const cambiarPersonas = (nuevas: number) => {
    const cuantas = Math.max(2, Math.min(20, nuevas))
    setPersonas(cuantas)
    setPagado(Array(cuantas).fill(null))
  }

  const marcar = (i: number, metodo: Pago['metodo']) => {
    setPagado((antes) => antes.map((p, j) => (j === i ? (p === metodo ? null : metodo) : p)))
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-cafe-100 px-5 py-4">
        <div>
          <div className="text-xs font-extrabold tracking-widest text-cafe-500 uppercase">
            Entre cuántos
          </div>
          <div className="mt-1 flex items-center gap-3">
            <button
              onClick={() => cambiarPersonas(personas - 1)}
              aria-label="Uno menos"
              className="h-11 w-11 rounded-xl border border-borde-fuerte bg-white text-2xl font-bold text-cafe-600 hover:bg-cafe-100"
            >
              −
            </button>
            <span className="w-10 text-center text-3xl font-extrabold tabular-nums">{personas}</span>
            <button
              onClick={() => cambiarPersonas(personas + 1)}
              aria-label="Uno más"
              className="h-11 w-11 rounded-xl border border-borde-fuerte bg-white text-2xl font-bold text-cafe-600 hover:bg-cafe-100"
            >
              +
            </button>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-extrabold tracking-widest text-cafe-500 uppercase">
            Toca a
          </div>
          <Importe className="text-4xl">{formatearEuros(importes[0])}</Importe>
          {importes[0] !== importes[importes.length - 1] && (
            <div className="text-xs font-semibold text-cafe-500">
              alguno paga {formatearEuros(importes[importes.length - 1])}
            </div>
          )}
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold text-cafe-500">
        Marca cómo paga cada uno. Toca otra vez para desmarcar.
      </p>

      <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto">
        {importes.map((importe, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
              pagado[i] ? 'border-cobro/40 bg-cobro/5' : 'border-borde bg-white'
            }`}
          >
            <span className="w-24 text-sm font-bold">Persona {i + 1}</span>
            <span className="flex-1 font-extrabold tabular-nums">{formatearEuros(importe)}</span>
            <button
              onClick={() => marcar(i, 'efectivo')}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                pagado[i] === 'efectivo'
                  ? 'bg-cobro text-white'
                  : 'border border-borde-fuerte bg-lino text-cafe-600 hover:bg-cafe-100'
              }`}
            >
              Efectivo
            </button>
            <button
              onClick={() => marcar(i, 'tarjeta')}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                pagado[i] === 'tarjeta'
                  ? 'bg-cafe-800 text-marfil'
                  : 'border border-borde-fuerte bg-lino text-cafe-600 hover:bg-cafe-100'
              }`}
            >
              Tarjeta
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
        <span className="text-sm font-bold text-cafe-500">
          {faltan === 0
            ? 'Han pagado todos'
            : `Faltan ${faltan} por pagar · llevas ${formatearEuros(cobrado)} de ${formatearEuros(total)}`}
        </span>
        <Boton
          tono="exito"
          disabled={faltan > 0}
          className="!py-4 !text-lg"
          onClick={() =>
            onCobrar(importes.map((importe, i) => ({ metodo: pagado[i]!, importe })))
          }
        >
          Cerrar la cuenta
        </Boton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CadaUnoLoSuyo({
  ticket,
  onCobrar,
}: {
  ticket: Ticket
  onCobrar: (seleccion: Seleccion, total: number) => void
}) {
  // Cuántas unidades de cada línea se lleva esta persona
  const [elegidas, setElegidas] = useState<number[]>(() => ticket.lineas.map(() => 0))

  const cambiar = (i: number, delta: number) => {
    setElegidas((antes) =>
      antes.map((n, j) =>
        j === i ? Math.max(0, Math.min(ticket.lineas[j].cantidad, n + delta)) : n,
      ),
    )
  }

  const total = ticket.lineas.reduce((s, l, i) => s + l.precio * elegidas[i], 0)
  const nada = total === 0
  const todo = ticket.lineas.every((l, i) => elegidas[i] === l.cantidad)

  const seleccion: Seleccion = elegidas
    .map((cantidad, indice) => ({ indice, cantidad }))
    .filter((s) => s.cantidad > 0)

  if (ticket.lineas.length === 0) {
    return <Vacio>La comanda está vacía.</Vacio>
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-cafe-500">
        Marca lo que ha tomado esta persona. Lo demás se queda en la mesa para los siguientes.
      </p>

      <ul className="mb-4 max-h-72 space-y-2 overflow-y-auto">
        {ticket.lineas.map((linea, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
              elegidas[i] > 0 ? 'border-oro bg-[#FFFBF0]' : 'border-borde bg-white'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{linea.nombre}</div>
              <div className="text-xs font-semibold text-cafe-500">
                {linea.cantidad} × {formatearEuros(linea.precio)} ={' '}
                {formatearEuros(totalLinea(linea))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => cambiar(i, -1)}
                aria-label={`Quitar ${linea.nombre}`}
                className="h-9 w-9 rounded-lg border border-cafe-200 bg-cafe-100 text-lg font-extrabold text-cafe-600 hover:bg-cafe-200"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-extrabold tabular-nums">
                {elegidas[i]}
              </span>
              <button
                onClick={() => cambiar(i, 1)}
                aria-label={`Añadir ${linea.nombre}`}
                className="h-9 w-9 rounded-lg border border-cafe-200 bg-cafe-100 text-lg font-extrabold text-cafe-600 hover:bg-cafe-200"
              >
                +
              </button>
            </div>

            <span className="w-20 text-right font-extrabold tabular-nums">
              {elegidas[i] > 0 ? formatearEuros(linea.precio * elegidas[i]) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
        <div>
          <div className="text-xs font-extrabold tracking-widest text-cafe-500 uppercase">
            Esta persona paga
          </div>
          <Importe className="text-3xl">{formatearEuros(total)}</Importe>
          {todo && (
            <div className="text-xs font-semibold text-cafe-500">
              Es la cuenta entera: la mesa quedará libre
            </div>
          )}
        </div>
        <Boton
          tono="exito"
          disabled={nada}
          className="!py-4 !text-lg"
          onClick={() => onCobrar(seleccion, total)}
        >
          Cobrar esta parte
        </Boton>
      </div>
    </div>
  )
}
