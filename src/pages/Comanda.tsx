import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Cliente, type Producto } from '../db'
import { Boton, Campo, Entrada, Etiqueta, Importe, Modal, Vacio, claseInput } from '../components/ui'
import { TecladoNumerico } from '../components/TecladoNumerico'
import {
  desglosarCambio,
  eurosACentimos,
  formatearEuros,
  limpiarImporte,
  sugerenciasPago,
  totalLinea,
} from '../lib/dinero'
import { imprimirTicket } from '../lib/ticket'
import { abrirCajon } from '../lib/cajon'
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
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])

  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [modal, setModal] = useState<'cobro' | 'cuenta' | 'libre' | 'mover' | null>(null)

  const cerrarBusqueda = () => {
    setBusqueda('')
    setBuscando(false)
  }

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
        {/* Las categorías se reparten todo el ancho: se ven de un vistazo y se
            aciertan con el dedo sin apuntar */}
        <div className="mb-3 flex items-stretch gap-2">
          {buscando ? (
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-oro bg-white px-4 ring-2 ring-oro/20">
              <IconoLupa />
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cerrarBusqueda()
                }}
                placeholder="Escribe el nombre del producto…"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-base font-semibold outline-none placeholder:font-normal placeholder:text-cafe-400"
              />
              <button
                onClick={cerrarBusqueda}
                aria-label="Cerrar la búsqueda"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl text-cafe-400 hover:bg-cafe-100 hover:text-cafe-900"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                {/* Todas las categorías van en el marrón de la casa, para que no
                    se confundan con los productos ni un segundo. La que está
                    puesta se marca en dorado. */}
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoriaActiva(c.id!)}
                    className={`min-w-[112px] flex-1 rounded-xl px-2.5 py-3.5 text-[15px] leading-tight font-bold transition-colors ${
                      c.id === categoriaMostrada
                        ? 'bg-oro text-cafe-900 shadow-[inset_0_0_0_2px_var(--color-cafe-800)]'
                        : 'bg-cafe-800 text-marfil hover:bg-cafe-700'
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBuscando(true)}
                aria-label="Buscar un producto"
                title="Buscar un producto"
                className="grid w-12 shrink-0 place-items-center rounded-xl border border-borde bg-white text-cafe-600 transition-colors hover:border-oro-medio hover:bg-cafe-100"
              >
                <IconoLupa />
              </button>
            </>
          )}
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto pb-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibles.map((p, i) => (
            <BotonProducto
              key={p.id}
              producto={p}
              alterno={i % 2 === 1}
              unidades={ticket.lineas
                .filter((l) => l.productoId === p.id)
                .reduce((s, l) => s + l.cantidad, 0)}
              onClick={() => anadirProducto(ticketId, p)}
            />
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
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-borde bg-white shadow-[0_2px_24px_rgba(51,32,15,.05)] lg:w-[420px]">
        <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
          <span className="rotulo">Comanda</span>
          <span className="text-[12.5px] font-bold text-cafe-500">
            {articulos} {articulos === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>

        <div className="max-h-[38vh] min-h-24 flex-1 overflow-y-auto px-5 lg:max-h-none">
          {vacia ? (
            <p className="px-2 py-10 text-center leading-relaxed font-semibold text-cafe-400">
              Mesa libre.
              <br />
              Toca un producto para abrirla.
            </p>
          ) : (
            <ul>
              {ticket.lineas.map((linea, i) => (
                <li key={i} className="flex items-center gap-2.5 border-b border-[#F4EBDD] py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] leading-tight font-bold">
                      {linea.nombre}
                    </div>
                    <div className="text-[11.5px] font-semibold text-cafe-500">
                      {linea.cantidad} × {formatearEuros(linea.precio)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => cambiarCantidad(ticketId, i, -1)}
                      aria-label="Quitar uno"
                      className="h-8 w-8 rounded-[9px] border border-cafe-200 bg-cafe-100 text-lg font-extrabold text-cafe-600 hover:bg-cafe-200"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-[15.5px] font-extrabold tabular-nums">
                      {linea.cantidad}
                    </span>
                    <button
                      onClick={() => cambiarCantidad(ticketId, i, 1)}
                      aria-label="Añadir uno"
                      className="h-8 w-8 rounded-[9px] border border-cafe-200 bg-cafe-100 text-lg font-extrabold text-cafe-600 hover:bg-cafe-200"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-[68px] text-right text-[15.5px] font-extrabold tabular-nums">
                    {formatearEuros(totalLinea(linea))}
                  </span>
                  <button
                    onClick={() => quitarLinea(ticketId, i)}
                    aria-label={`Borrar ${linea.nombre}`}
                    className="h-7 w-7 shrink-0 rounded-lg text-cafe-300 hover:bg-[#FFF7F5] hover:text-anular"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-borde bg-lino px-5 py-3">
          <div className="flex items-end justify-between">
            <span className="text-xs font-extrabold tracking-widest text-cafe-500 uppercase">
              Total
            </span>
            <Importe className="text-[40px] leading-none">{formatearEuros(ticket.total)}</Importe>
          </div>
        </div>

        <div className="p-5 pt-4">
          <Boton
            tono="exito"
            disabled={vacia}
            onClick={() => setModal('cobro')}
            className="mb-2 flex h-16 w-full items-center justify-center gap-3 !rounded-2xl !text-xl"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Cobrar
          </Boton>

          <div className="grid grid-cols-2 gap-2">
            <Boton tono="neutro" disabled={vacia} onClick={() => setModal('cuenta')}>
              A cuenta
            </Boton>
            <Boton tono="neutro" onClick={() => setModal('libre')}>
              Otro concepto
            </Boton>
            <Boton tono="neutro" onClick={() => setModal('mover')}>
              Cambiar mesa
            </Boton>
            <Boton
              onClick={async () => {
                if (!vacia && !confirm('¿Seguro que quieres anular esta comanda entera?')) return
                await anularTicket(ticketId)
                onSalir()
              }}
              className="border border-[#F0D3CC] bg-[#FFF7F5] text-anular hover:bg-[#FDEDE9]"
            >
              Anular
            </Boton>
          </div>
        </div>
      </aside>

      <ModalCobro
        abierto={modal === 'cobro'}
        total={ticket.total}
        imprimir={ajustes?.imprimirAlCobrar === 1}
        onCambiarImprimir={(valor) => db.ajustes.update(1, { imprimirAlCobrar: valor ? 1 : 0 })}
        onCerrar={() => setModal(null)}
        onCobrar={async (metodo, recibido) => {
          const cobrado = await cobrarTicket(ticketId, metodo, recibido)
          if (cobrado && ajustes?.imprimirAlCobrar === 1) imprimirTicket(cobrado, ajustes)

          // El cajón solo se abre con el efectivo: con tarjeta no hay que dar cambio
          if (metodo === 'efectivo' && ajustes?.abrirCajonAlCobrar === 1) {
            abrirCajon(ajustes.baudiosCajon).catch(() => {
              // Que el cajón falle no puede dejar la venta a medias
            })
          }

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

function IconoLupa() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function BotonProducto({
  producto,
  unidades,
  alterno,
  onClick,
}: {
  producto: Producto
  unidades: number
  /** Los productos van alternando color, para no confundir uno con el de al lado */
  alterno: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-24 flex-col justify-between rounded-xl border border-borde p-3 text-left transition-all hover:border-oro-medio hover:shadow-[0_8px_18px_rgba(51,32,15,.10)] active:scale-[0.97] ${
        alterno ? 'bg-[#EFEBE4]' : 'bg-white'
      }`}
    >
      <span className="line-clamp-2 text-[14.5px] leading-tight font-bold">{producto.nombre}</span>
      <span className="flex items-end justify-between">
        <span className="text-[17px] font-extrabold tabular-nums text-cafe-600">
          {formatearEuros(producto.precio)}
        </span>
        {unidades > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-cafe-800 px-1.5 text-xs font-extrabold text-marfil">
            {unidades}
          </span>
        )}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------

function ModalCobro({
  abierto,
  total,
  imprimir,
  onCambiarImprimir,
  onCerrar,
  onCobrar,
}: {
  abierto: boolean
  total: number
  imprimir: boolean
  onCambiarImprimir: (valor: boolean) => void
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

  // Dos columnas: a la izquierda el dinero, a la derecha el teclado.
  // Así entra entero en la pantalla y no hay que deslizar para cobrar.
  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Cobrar" ancho="max-w-4xl">
      <div className="grid gap-4 md:grid-cols-2">
        {/* ----------------------------- El dinero ----------------------------- */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-cafe-800 px-5 py-4 text-marfil">
            <div className="text-[11px] font-extrabold tracking-widest text-[#D8BE93] uppercase">
              Importe a cobrar
            </div>
            <Importe className="text-5xl">{formatearEuros(total)}</Importe>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-cafe-200 bg-white px-3 py-2 focus-within:border-oro focus-within:ring-2 focus-within:ring-oro/20">
              <label
                htmlFor="paga-con"
                className="text-[10.5px] font-extrabold tracking-widest text-cafe-500 uppercase"
              >
                Paga con
              </label>
              {/* Se puede escribir con el teclado del ordenador, que es más rápido */}
              <input
                id="paga-con"
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={texto}
                onChange={(e) => setTexto(limpiarImporte(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && suficiente) {
                    setTexto('')
                    onCobrar('efectivo', recibido)
                  }
                }}
                className="w-full bg-transparent text-[28px] leading-tight font-extrabold tabular-nums outline-none placeholder:text-cafe-300"
              />
            </div>
            <div
              className={`rounded-xl px-3 py-2.5 ${
                cambio === null
                  ? 'border border-cafe-200 bg-white'
                  : suficiente
                    ? 'bg-cobro text-white'
                    : 'bg-[#FFF7F5] text-anular'
              }`}
            >
              <div className="text-[10.5px] font-extrabold tracking-widest uppercase opacity-75">
                {cambio !== null && !suficiente ? 'Faltan' : 'Cambio'}
              </div>
              <div className="text-[28px] leading-tight font-extrabold tabular-nums">
                {cambio === null ? '—' : formatearEuros(Math.abs(cambio))}
              </div>
            </div>
          </div>

          <div className="min-h-[34px] rounded-xl bg-cafe-100 px-3 py-2 text-xs leading-relaxed font-semibold text-cafe-600">
            {suficiente && cambio! > 0 ? (
              <>
                <span className="text-cafe-500">Devolver: </span>
                {desglosarCambio(cambio!)
                  .map((d) => `${d.unidades} × ${formatearEuros(d.valor)}`)
                  .join('  ·  ')}
              </>
            ) : suficiente ? (
              'Importe justo, no hay que devolver nada.'
            ) : (
              'Escribe con cuánto paga y aquí saldrá el cambio en monedas.'
            )}
          </div>

          <Boton
            tono="exito"
            disabled={!suficiente}
            className="!py-4 !text-lg"
            onClick={() => {
              setTexto('')
              onCobrar('efectivo', recibido)
            }}
          >
            Cobrado en efectivo
          </Boton>

          <Boton
            tono="principal"
            className="!py-4 !text-lg"
            onClick={() => {
              setTexto('')
              onCobrar('tarjeta', null)
            }}
          >
            Cobrar con tarjeta
          </Boton>
        </div>

        {/* ----------------------------- El teclado ----------------------------- */}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            {sugerenciasPago(total).map((s) => (
              <button
                key={s}
                onClick={() => setTexto((s / 100).toFixed(2).replace('.', ','))}
                className="rounded-xl border border-borde-fuerte bg-lino py-2.5 text-sm font-bold text-cafe-600 hover:bg-cafe-100"
              >
                {formatearEuros(s)}
              </button>
            ))}
          </div>
          <TecladoNumerico valor={texto} onCambio={setTexto} className="flex-1" />

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-borde bg-white px-4 py-2.5">
            <input
              type="checkbox"
              checked={imprimir}
              onChange={(e) => onCambiarImprimir(e.target.checked)}
              className="h-5 w-5 accent-cafe-800"
            />
            <span className="text-sm font-bold text-cafe-600">Imprimir el ticket al cobrar</span>
          </label>
        </div>
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
