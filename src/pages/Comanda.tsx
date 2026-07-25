import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Cliente, type Producto } from '../db'
import { Boton, Campo, Entrada, Etiqueta, Modal, Vacio, claseInput } from '../components/ui'
import { TecladoNumerico } from '../components/TecladoNumerico'
import { desglosarCambio, eurosACentimos, formatearEuros, sugerenciasPago, totalLinea } from '../lib/dinero'
import {
  anadirLineaLibre,
  anadirProducto,
  anularTicket,
  apuntarACuenta,
  cambiarCantidad,
  cobrarTicket,
  moverTicket,
  quitarLinea,
} from '../lib/acciones'

export function Comanda({ ticketId, onSalir }: { ticketId: number; onSalir: () => void }) {
  const ticket = useLiveQuery(() => db.tickets.get(ticketId), [ticketId])
  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])
  const productos = useLiveQuery(
    () => db.productos.where('activo').equals(1).sortBy('orden'),
    [],
    [],
  )
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], [])

  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'cobro' | 'cuenta' | 'libre' | 'mover' | null>(null)

  const categoriaMostrada = categoriaActiva ?? categorias[0]?.id ?? null

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (texto) {
      return productos.filter((p) => p.nombre.toLowerCase().includes(texto))
    }
    return productos.filter((p) => p.categoriaId === categoriaMostrada)
  }, [productos, busqueda, categoriaMostrada])

  if (ticket === undefined) return null
  if (ticket === null) {
    return (
      <div>
        <Vacio>Esta comanda ya no existe.</Vacio>
        <div className="mt-4">
          <Boton onClick={onSalir}>← Volver a las mesas</Boton>
        </div>
      </div>
    )
  }

  const articulos = ticket.lineas.reduce((s, l) => s + l.cantidad, 0)
  const vacia = ticket.lineas.length === 0

  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      {/* ------------------------------- Carta ------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Boton tono="suave" onClick={onSalir}>
            ← Mesas
          </Boton>
          <h1 className="text-2xl font-bold text-cafe-900">{ticket.mesaNombre}</h1>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className={`${claseInput} ml-auto max-w-56`}
          />
        </div>

        {!busqueda && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoriaActiva(c.id!)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  c.id === categoriaMostrada
                    ? 'bg-cafe-600 text-white'
                    : 'bg-white text-cafe-700 hover:bg-cafe-100'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto pb-2 sm:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => (
            <BotonProducto key={p.id} producto={p} onClick={() => anadirProducto(ticketId, p)} />
          ))}
          {visibles.length === 0 && (
            <div className="col-span-full">
              <Vacio>
                {busqueda ? 'Ningún producto con ese nombre.' : 'Esta categoría no tiene productos.'}
              </Vacio>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ Comanda ------------------------------ */}
      <div className="flex w-full shrink-0 flex-col rounded-2xl border border-cafe-200 bg-white lg:w-96">
        <div className="flex items-center justify-between border-b border-cafe-100 px-4 py-3">
          <span className="font-bold text-cafe-900">Comanda</span>
          <span className="text-sm text-cafe-500">
            {articulos} {articulos === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>

        <div className="max-h-[45vh] min-h-24 flex-1 overflow-y-auto lg:max-h-none">
          {vacia ? (
            <p className="px-4 py-10 text-center text-cafe-400">
              Toca los productos de la izquierda para añadirlos.
            </p>
          ) : (
            <ul className="divide-y divide-cafe-100">
              {ticket.lineas.map((linea, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-cafe-900">{linea.nombre}</div>
                    <div className="text-xs text-cafe-500">
                      {linea.cantidad} × {formatearEuros(linea.precio)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => cambiarCantidad(ticketId, i, -1)}
                      aria-label="Quitar uno"
                      className="h-9 w-9 rounded-lg bg-cafe-100 text-lg font-bold text-cafe-700 hover:bg-cafe-200"
                    >
                      −
                    </button>
                    <span className="w-7 text-center font-bold tabular-nums">{linea.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(ticketId, i, 1)}
                      aria-label="Añadir uno"
                      className="h-9 w-9 rounded-lg bg-cafe-100 text-lg font-bold text-cafe-700 hover:bg-cafe-200"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 text-right font-bold tabular-nums text-cafe-900">
                    {formatearEuros(totalLinea(linea))}
                  </span>
                  <button
                    onClick={() => quitarLinea(ticketId, i)}
                    aria-label={`Borrar ${linea.nombre}`}
                    className="h-8 w-8 shrink-0 rounded-lg text-cafe-300 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-cafe-100 p-4">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-cafe-700">Total</span>
            <span className="text-4xl font-bold tabular-nums text-cafe-900">
              {formatearEuros(ticket.total)}
            </span>
          </div>

          <div className="grid gap-2">
            <Boton tono="exito" disabled={vacia} onClick={() => setModal('cobro')} className="!py-4 !text-lg">
              Cobrar
            </Boton>
            <div className="grid grid-cols-2 gap-2">
              <Boton tono="suave" disabled={vacia} onClick={() => setModal('cuenta')}>
                A cuenta
              </Boton>
              <Boton tono="suave" onClick={() => setModal('libre')}>
                Otro concepto
              </Boton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Boton tono="neutro" onClick={() => setModal('mover')}>
                Cambiar de mesa
              </Boton>
              <Boton
                tono="neutro"
                onClick={async () => {
                  if (!vacia && !confirm('¿Seguro que quieres anular esta comanda entera?')) return
                  await anularTicket(ticketId)
                  onSalir()
                }}
                className="!text-red-600"
              >
                Anular
              </Boton>
            </div>
          </div>
        </div>
      </div>

      <ModalCobro
        abierto={modal === 'cobro'}
        total={ticket.total}
        onCerrar={() => setModal(null)}
        onCobrar={async (metodo, recibido) => {
          await cobrarTicket(ticketId, metodo, recibido)
          setModal(null)
          onSalir()
        }}
      />

      <ModalACuenta
        abierto={modal === 'cuenta'}
        clientes={clientes}
        total={ticket.total}
        onCerrar={() => setModal(null)}
        onConfirmar={async (cliente) => {
          await apuntarACuenta(ticketId, cliente)
          setModal(null)
          onSalir()
        }}
      />

      <ModalLineaLibre
        abierto={modal === 'libre'}
        onCerrar={() => setModal(null)}
        onAnadir={async (nombre, precio, iva, cantidad) => {
          await anadirLineaLibre(ticketId, { productoId: null, nombre, precio, iva, cantidad })
          setModal(null)
        }}
      />

      <ModalMover
        abierto={modal === 'mover'}
        mesaActualId={ticket.mesaId}
        onCerrar={() => setModal(null)}
        onMover={async (mesaId, nombre) => {
          await moverTicket(ticketId, mesaId, nombre)
          setModal(null)
          onSalir()
        }}
      />
    </div>
  )
}

function BotonProducto({ producto, onClick }: { producto: Producto; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-24 flex-col justify-between rounded-xl border border-cafe-200 bg-white p-3 text-left transition-all hover:border-cafe-400 hover:bg-cafe-50 active:scale-[0.97]"
    >
      <span className="line-clamp-2 text-sm leading-tight font-semibold text-cafe-900">
        {producto.nombre}
      </span>
      <span className="text-lg font-bold text-cafe-600">{formatearEuros(producto.precio)}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------

function ModalCobro({
  abierto,
  total,
  onCerrar,
  onCobrar,
}: {
  abierto: boolean
  total: number
  onCerrar: () => void
  onCobrar: (metodo: 'efectivo' | 'tarjeta', recibido: number | null) => void
}) {
  const [texto, setTexto] = useState('')
  const recibido = eurosACentimos(texto)
  const cambio = recibido === null ? null : recibido - total
  const suficiente = cambio !== null && cambio >= 0

  const cerrar = () => {
    setTexto('')
    onCerrar()
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Cobrar" ancho="max-w-md">
      <div className="mb-4 rounded-2xl bg-cafe-600 px-5 py-4 text-white">
        <div className="text-sm opacity-80">Total a cobrar</div>
        <div className="text-5xl font-bold tabular-nums">{formatearEuros(total)}</div>
      </div>

      <Boton
        tono="principal"
        className="mb-4 w-full !py-4 !text-lg"
        onClick={() => {
          setTexto('')
          onCobrar('tarjeta', null)
        }}
      >
        Cobrar con tarjeta
      </Boton>

      <div className="rounded-2xl bg-cafe-100 p-4">
        <div className="mb-2 text-sm font-bold text-cafe-700">Efectivo: ¿con cuánto paga?</div>

        <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-3">
          <span className="text-3xl font-bold tabular-nums text-cafe-900">{texto || '0'}</span>
          <span className="text-xl font-bold text-cafe-400">€</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {sugerenciasPago(total).map((s) => (
            <button
              key={s}
              onClick={() => setTexto((s / 100).toFixed(2).replace('.', ','))}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-cafe-700 shadow-sm hover:bg-cafe-50"
            >
              {formatearEuros(s)}
            </button>
          ))}
        </div>

        <TecladoNumerico valor={texto} onCambio={setTexto} className="mb-3" />

        {cambio !== null && (
          <div
            className={`mb-3 rounded-xl px-4 py-3 ${
              suficiente ? 'bg-emerald-600 text-white' : 'bg-red-100 text-red-800'
            }`}
          >
            {suficiente ? (
              <>
                <div className="text-sm opacity-90">Cambio a devolver</div>
                <div className="text-4xl font-bold tabular-nums">{formatearEuros(cambio)}</div>
                {cambio > 0 && (
                  <div className="mt-1 text-xs opacity-90">
                    {desglosarCambio(cambio)
                      .map((d) => `${d.unidades} × ${formatearEuros(d.valor)}`)
                      .join('  ·  ')}
                  </div>
                )}
              </>
            ) : (
              <div className="font-bold">Faltan {formatearEuros(-cambio)}</div>
            )}
          </div>
        )}

        <Boton
          tono="exito"
          disabled={!suficiente}
          className="w-full !py-4 !text-lg"
          onClick={() => {
            setTexto('')
            onCobrar('efectivo', recibido)
          }}
        >
          Cobrado en efectivo
        </Boton>
      </div>
    </Modal>
  )
}

function ModalACuenta({
  abierto,
  clientes,
  total,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean
  clientes: Cliente[]
  total: number
  onCerrar: () => void
  onConfirmar: (cliente: Cliente) => void
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Apuntar a cuenta de un cliente">
      <p className="mb-4 text-sm text-cafe-600">
        Se apuntan <b>{formatearEuros(total)}</b> a la cuenta del cliente. No entra en la caja de hoy:
        quedará pendiente hasta que le hagas la factura.
      </p>

      {clientes.length === 0 ? (
        <Vacio>
          Todavía no hay clientes.
          <br />
          Créalos en la pestaña <b>Clientes</b>.
        </Vacio>
      ) : (
        <div className="grid gap-2">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => onConfirmar(c)}
              className="rounded-xl border border-cafe-200 bg-white px-4 py-3 text-left hover:border-cafe-400 hover:bg-cafe-50"
            >
              <div className="font-bold text-cafe-900">{c.nombre}</div>
              {c.nif && <div className="text-xs text-cafe-500">{c.nif}</div>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function ModalLineaLibre({
  abierto,
  onCerrar,
  onAnadir,
}: {
  abierto: boolean
  onCerrar: () => void
  onAnadir: (nombre: string, precio: number, iva: number, cantidad: number) => void
}) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [iva, setIva] = useState('10')

  const centimos = eurosACentimos(precio)
  const uds = Number(cantidad)
  const valido = nombre.trim() !== '' && centimos !== null && centimos > 0 && uds > 0

  const cerrar = () => {
    setNombre('')
    setPrecio('')
    setCantidad('1')
    onCerrar()
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Añadir un concepto suelto">
      <p className="mb-4 text-sm text-cafe-600">
        Para algo que no está en la carta. No se guarda en la carta, solo en esta comanda.
      </p>
      <div className="grid gap-3">
        <Campo etiqueta="Concepto">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Menú del día" />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Precio (€)">
            <Entrada
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </Campo>
          <Campo etiqueta="Unidades">
            <Entrada
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              inputMode="numeric"
              type="number"
              min={1}
            />
          </Campo>
          <Campo etiqueta="IVA">
            <select value={iva} onChange={(e) => setIva(e.target.value)} className={claseInput}>
              <option value="10">10 %</option>
              <option value="21">21 %</option>
              <option value="4">4 %</option>
              <option value="0">0 %</option>
            </select>
          </Campo>
        </div>
        <Boton
          tono="principal"
          disabled={!valido}
          onClick={() => {
            onAnadir(nombre.trim(), centimos!, Number(iva), uds)
            setNombre('')
            setPrecio('')
            setCantidad('1')
          }}
        >
          Añadir a la comanda
        </Boton>
      </div>
    </Modal>
  )
}

function ModalMover({
  abierto,
  mesaActualId,
  onCerrar,
  onMover,
}: {
  abierto: boolean
  mesaActualId: number | null
  onCerrar: () => void
  onMover: (mesaId: number, nombre: string) => void
}) {
  const mesas = useLiveQuery(() => db.mesas.orderBy('orden').toArray(), [], [])
  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])
  const ocupadas = new Set(abiertos.filter((t) => t.mesaId !== null).map((t) => t.mesaId!))

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Llevar la comanda a otra mesa">
      <p className="mb-4 text-sm text-cafe-600">
        Si la mesa de destino ya tiene comanda, las dos se juntan en una sola.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {mesas
          .filter((m) => m.id !== mesaActualId)
          .map((m) => (
            <button
              key={m.id}
              onClick={() => onMover(m.id!, m.nombre)}
              className="rounded-xl border border-cafe-200 bg-white px-3 py-3 font-semibold text-cafe-900 hover:border-cafe-400 hover:bg-cafe-50"
            >
              {m.nombre}
              {ocupadas.has(m.id!) && (
                <span className="mt-1 block">
                  <Etiqueta tono="ambar">ocupada</Etiqueta>
                </span>
              )}
            </button>
          ))}
      </div>
    </Modal>
  )
}
