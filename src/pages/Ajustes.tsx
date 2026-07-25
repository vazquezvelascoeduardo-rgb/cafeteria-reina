import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, type Categoria, type DatosEmisor, type Mesa, type Producto } from '../db'
import { Boton, Campo, Entrada, Etiqueta, Modal, Tarjeta, Vacio, claseInput } from '../components/ui'
import { eurosACentimos, formatearEuros, formatearNumero } from '../lib/dinero'
import { exportarCopia, importarCopia } from '../lib/acciones'
import {
  descargar,
  descargarBlob,
  filasDeLaHoja,
  generarHojas,
  type Hoja,
} from '../lib/exportar'
import { crearZip } from '../lib/zip'
import {
  anadirCarpeta,
  copiarAhora,
  hayApiDeCarpetas,
  listarCarpetas,
  quitarCarpeta,
  ultimaCopia,
  type CarpetaCopia,
} from '../lib/copiaAutomatica'
import {
  aDiaLocal,
  aMesLocal,
  formatearDia,
  mesAnterior,
  rangoDeAnyo,
  rangoDeMes,
  trimestreAnterior,
  trimestreDe,
} from '../lib/fechas'

type Seccion = 'negocio' | 'carta' | 'mesas' | 'copia'

const SECCIONES: { id: Seccion; nombre: string }[] = [
  { id: 'negocio', nombre: 'Datos de la cafetería' },
  { id: 'carta', nombre: 'Carta y precios' },
  { id: 'mesas', nombre: 'Mesas' },
  { id: 'copia', nombre: 'Copia de seguridad' },
]

export function Ajustes() {
  const [seccion, setSeccion] = useState<Seccion>('negocio')

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              seccion === s.id
                ? 'bg-cafe-800 text-marfil'
                : 'border border-borde bg-white text-cafe-600 hover:bg-cafe-100'
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      {seccion === 'negocio' && <DatosNegocio />}
      {seccion === 'carta' && <Carta />}
      {seccion === 'mesas' && <Mesas />}
      {seccion === 'copia' && <CopiaSeguridad />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function DatosNegocio() {
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])
  const [guardado, setGuardado] = useState(false)

  if (!ajustes) return null

  const setEmisor = (campo: keyof DatosEmisor) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.ajustes.update(1, { emisor: { ...ajustes.emisor, [campo]: e.target.value } })
    setGuardado(true)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Datos fiscales</h2>
        <p className="mb-4 text-sm text-cafe-500">
          Son los que aparecerán como emisor en las facturas. Se guardan solos al escribir.
        </p>
        <div className="grid gap-3">
          <Campo etiqueta="Nombre o razón social">
            <Entrada
              value={ajustes.emisor.nombre}
              onChange={setEmisor('nombre')}
              placeholder="Ej. Cafetería La Plaza"
            />
          </Campo>
          <Campo etiqueta="NIF / CIF">
            <Entrada value={ajustes.emisor.nif} onChange={setEmisor('nif')} placeholder="12345678Z" />
          </Campo>
          <Campo etiqueta="Dirección">
            <Entrada value={ajustes.emisor.direccion} onChange={setEmisor('direccion')} />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="C.P.">
              <Entrada value={ajustes.emisor.cp} onChange={setEmisor('cp')} />
            </Campo>
            <Campo etiqueta="Población">
              <Entrada value={ajustes.emisor.ciudad} onChange={setEmisor('ciudad')} />
            </Campo>
            <Campo etiqueta="Provincia">
              <Entrada value={ajustes.emisor.provincia} onChange={setEmisor('provincia')} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Teléfono">
              <Entrada value={ajustes.emisor.telefono} onChange={setEmisor('telefono')} />
            </Campo>
            <Campo etiqueta="Email">
              <Entrada value={ajustes.emisor.email} onChange={setEmisor('email')} type="email" />
            </Campo>
          </div>
        </div>
        {guardado && <p className="mt-3 text-sm font-semibold text-emerald-600">Cambios guardados</p>}
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Numeración de facturas</h2>
        <p className="mb-4 text-sm text-cafe-500">
          Las facturas se numeran solas y de forma correlativa, como exige Hacienda. La numeración vuelve
          a empezar cada año.
        </p>
        <div className="grid gap-3">
          <Campo etiqueta="Serie" ayuda="Una letra o palabra corta. Aparece delante del número.">
            <Entrada
              value={ajustes.serieFactura}
              onChange={(e) => db.ajustes.update(1, { serieFactura: e.target.value.toUpperCase() })}
              maxLength={6}
            />
          </Campo>
          <div className="rounded-xl bg-cafe-100 px-4 py-3">
            <div className="text-xs text-cafe-500">La siguiente factura será</div>
            <div className="text-2xl font-bold text-cafe-900">
              {ajustes.serieFactura}-{new Date().getFullYear()}-
              {String(
                (ajustes.ejercicioFactura === new Date().getFullYear() ? ajustes.contadorFactura : 0) + 1,
              ).padStart(4, '0')}
            </div>
          </div>
        </div>
      </Tarjeta>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Carta() {
  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])
  const productos = useLiveQuery(() => db.productos.orderBy('orden').toArray(), [], [])

  const [editando, setEditando] = useState<Producto | null>(null)
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null)

  const nuevoProducto = (categoriaId: number): Producto => ({
    nombre: '',
    precio: 0,
    categoriaId,
    iva: 10,
    activo: 1,
    orden: productos.length + 1,
  })

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <Boton
          tono="principal"
          onClick={() =>
            setEditandoCat({ nombre: '', color: '#7c4a2d', orden: categorias.length + 1 })
          }
        >
          + Nueva categoría
        </Boton>
      </div>

      {categorias.length === 0 && <Vacio>No hay categorías. Crea la primera para añadir productos.</Vacio>}

      <div className="grid gap-5">
        {categorias.map((cat) => {
          const suyos = productos.filter((p) => p.categoriaId === cat.id)
          return (
            <Tarjeta key={cat.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-cafe-900">{cat.nombre}</h2>
                <div className="flex gap-2">
                  <Boton tono="suave" onClick={() => setEditando(nuevoProducto(cat.id!))}>
                    + Producto
                  </Boton>
                  <Boton tono="neutro" onClick={() => setEditandoCat(cat)}>
                    Editar categoría
                  </Boton>
                </div>
              </div>

              {suyos.length === 0 ? (
                <p className="text-sm text-cafe-400">Sin productos todavía.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {suyos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEditando(p)}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:border-cafe-400 hover:bg-cafe-50 ${
                        p.activo ? 'border-cafe-200 bg-white' : 'border-dashed border-cafe-300 bg-cafe-50/50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-cafe-900">{p.nombre}</span>
                        <span className="text-xs text-cafe-400">
                          IVA {p.iva} %{!p.activo && ' · oculto'}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-cafe-700">
                        {formatearEuros(p.precio)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Tarjeta>
          )
        })}
      </div>

      <ModalProducto
        producto={editando}
        onCerrar={() => setEditando(null)}
        onGuardar={async (p) => {
          if (p.id === undefined) await db.productos.add(p)
          else await db.productos.put(p)
          setEditando(null)
        }}
        onBorrar={async (id) => {
          await db.productos.delete(id)
          setEditando(null)
        }}
      />

      <ModalCategoria
        categoria={editandoCat}
        onCerrar={() => setEditandoCat(null)}
        onGuardar={async (c) => {
          if (c.id === undefined) await db.categorias.add(c)
          else await db.categorias.put(c)
          setEditandoCat(null)
        }}
        onBorrar={async (id) => {
          const cuantos = await db.productos.where({ categoriaId: id }).count()
          if (cuantos > 0) {
            alert('No se puede borrar: la categoría todavía tiene productos dentro.')
            return
          }
          await db.categorias.delete(id)
          setEditandoCat(null)
        }}
      />
    </div>
  )
}

function ModalProducto({
  producto,
  onCerrar,
  onGuardar,
  onBorrar,
}: {
  producto: Producto | null
  onCerrar: () => void
  onGuardar: (p: Producto) => void
  onBorrar: (id: number) => void
}) {
  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])
  const [borrador, setBorrador] = useState<Producto | null>(null)
  const [precio, setPrecio] = useState('')
  const [cargado, setCargado] = useState<Producto | null>(null)

  if (producto !== cargado) {
    setCargado(producto)
    setBorrador(producto)
    setPrecio(producto && producto.precio > 0 ? formatearNumero(producto.precio) : '')
  }

  if (!borrador) return null

  const centimos = eurosACentimos(precio)
  const valido = borrador.nombre.trim() !== '' && centimos !== null && centimos >= 0

  return (
    <Modal
      abierto={producto !== null}
      onCerrar={onCerrar}
      titulo={producto?.id === undefined ? 'Nuevo producto' : 'Editar producto'}
    >
      <div className="grid gap-3">
        <Campo etiqueta="Nombre">
          <Entrada
            value={borrador.nombre}
            onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            placeholder="Ej. Café con leche"
          />
        </Campo>
        <Campo etiqueta="Categoría" ayuda="Cámbiala para mover el producto de sitio en la carta">
          <select
            value={borrador.categoriaId}
            onChange={(e) => setBorrador({ ...borrador, categoriaId: Number(e.target.value) })}
            className={claseInput}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio de venta (€)" ayuda="Con IVA incluido, el de la carta">
            <Entrada
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="!text-xl !font-bold"
            />
          </Campo>
          <Campo etiqueta="IVA">
            <select
              value={borrador.iva}
              onChange={(e) => setBorrador({ ...borrador, iva: Number(e.target.value) })}
              className={claseInput}
            >
              <option value={10}>10 % (hostelería)</option>
              <option value={4}>4 % (pan común)</option>
              <option value={21}>21 %</option>
              <option value={0}>0 %</option>
            </select>
          </Campo>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-cafe-100 px-4 py-3">
          <input
            type="checkbox"
            checked={borrador.activo === 1}
            onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked ? 1 : 0 })}
            className="h-5 w-5 accent-cafe-600"
          />
          <span className="text-sm font-semibold text-cafe-800">Se muestra en la carta</span>
        </label>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Boton
            tono="principal"
            disabled={!valido}
            onClick={() => onGuardar({ ...borrador, precio: centimos! })}
          >
            Guardar
          </Boton>
          <Boton tono="neutro" onClick={onCerrar}>
            Cancelar
          </Boton>
          {borrador.id !== undefined && (
            <Boton
              tono="neutro"
              className="ml-auto !text-red-600"
              onClick={() => {
                if (confirm(`¿Borrar "${borrador.nombre}" de la carta?`)) onBorrar(borrador.id!)
              }}
            >
              Borrar
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ModalCategoria({
  categoria,
  onCerrar,
  onGuardar,
  onBorrar,
}: {
  categoria: Categoria | null
  onCerrar: () => void
  onGuardar: (c: Categoria) => void
  onBorrar: (id: number) => void
}) {
  const [borrador, setBorrador] = useState<Categoria | null>(null)
  const [cargado, setCargado] = useState<Categoria | null>(null)

  if (categoria !== cargado) {
    setCargado(categoria)
    setBorrador(categoria)
  }

  if (!borrador) return null

  return (
    <Modal
      abierto={categoria !== null}
      onCerrar={onCerrar}
      titulo={categoria?.id === undefined ? 'Nueva categoría' : 'Editar categoría'}
    >
      <div className="grid gap-3">
        <Campo etiqueta="Nombre">
          <Entrada
            value={borrador.nombre}
            onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            placeholder="Ej. Cafés e infusiones"
          />
        </Campo>
        <Campo etiqueta="Orden" ayuda="Las de número más bajo salen primero">
          <Entrada
            type="number"
            value={borrador.orden}
            onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
          />
        </Campo>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Boton
            tono="principal"
            disabled={borrador.nombre.trim() === ''}
            onClick={() => onGuardar(borrador)}
          >
            Guardar
          </Boton>
          <Boton tono="neutro" onClick={onCerrar}>
            Cancelar
          </Boton>
          {borrador.id !== undefined && (
            <Boton
              tono="neutro"
              className="ml-auto !text-red-600"
              onClick={() => {
                if (confirm(`¿Borrar la categoría "${borrador.nombre}"?`)) onBorrar(borrador.id!)
              }}
            >
              Borrar
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function Mesas() {
  const mesas = useLiveQuery(() => db.mesas.orderBy('orden').toArray(), [], [])
  const [editando, setEditando] = useState<Mesa | null>(null)

  return (
    <div>
      <div className="mb-5">
        <Boton
          tono="principal"
          onClick={() => setEditando({ nombre: '', zona: 'Salón', orden: mesas.length + 1 })}
        >
          + Nueva mesa
        </Boton>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {mesas.map((m) => (
          <button
            key={m.id}
            onClick={() => setEditando(m)}
            className="rounded-xl border border-cafe-200 bg-white px-4 py-3 text-left hover:border-cafe-400 hover:bg-cafe-50"
          >
            <span className="block font-bold text-cafe-900">{m.nombre}</span>
            <span className="text-xs text-cafe-400">{m.zona}</span>
          </button>
        ))}
      </div>

      <Modal
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando?.id === undefined ? 'Nueva mesa' : 'Editar mesa'}
      >
        {editando && (
          <div className="grid gap-3">
            <Campo etiqueta="Nombre">
              <Entrada
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                placeholder="Ej. Mesa 11"
              />
            </Campo>
            <Campo etiqueta="Zona" ayuda="Las mesas se agrupan por zona en la pantalla principal">
              <Entrada
                value={editando.zona}
                onChange={(e) => setEditando({ ...editando, zona: e.target.value })}
                placeholder="Salón, Terraza, Barra…"
              />
            </Campo>
            <Campo etiqueta="Orden">
              <Entrada
                type="number"
                value={editando.orden}
                onChange={(e) => setEditando({ ...editando, orden: Number(e.target.value) })}
              />
            </Campo>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Boton
                tono="principal"
                disabled={editando.nombre.trim() === ''}
                onClick={async () => {
                  if (editando.id === undefined) await db.mesas.add(editando)
                  else await db.mesas.put(editando)
                  setEditando(null)
                }}
              >
                Guardar
              </Boton>
              <Boton tono="neutro" onClick={() => setEditando(null)}>
                Cancelar
              </Boton>
              {editando.id !== undefined && (
                <Boton
                  tono="neutro"
                  className="ml-auto !text-red-600"
                  onClick={async () => {
                    const abierta = await db.tickets
                      .where({ mesaId: editando.id! })
                      .and((t) => t.estado === 'abierto')
                      .count()
                    if (abierta > 0) {
                      alert('Esta mesa tiene una comanda abierta. Cóbrala o anúlala antes de borrarla.')
                      return
                    }
                    if (confirm(`¿Borrar "${editando.nombre}"?`)) {
                      await db.mesas.delete(editando.id!)
                      setEditando(null)
                    }
                  }}
                >
                  Borrar
                </Boton>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------

type OpcionPeriodo =
  | 'todo'
  | 'mes'
  | 'mes-pasado'
  | 'trimestre'
  | 'trimestre-pasado'
  | 'anyo'
  | 'personalizado'

const OPCIONES_PERIODO: { id: OpcionPeriodo; nombre: string }[] = [
  { id: 'todo', nombre: 'Todo el histórico' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mes-pasado', nombre: 'El mes pasado' },
  { id: 'trimestre', nombre: 'Este trimestre' },
  { id: 'trimestre-pasado', nombre: 'El trimestre pasado' },
  { id: 'anyo', nombre: 'Este año' },
  { id: 'personalizado', nombre: 'Entre dos fechas concretas…' },
]

/** Traduce la opción elegida a un rango de fechas concreto */
function rangoDelPeriodo(
  opcion: OpcionPeriodo,
  desde: string,
  hasta: string,
): { desde: string; hasta: string } | undefined {
  switch (opcion) {
    case 'todo':
      return undefined
    case 'mes':
      return rangoDeMes(aMesLocal())
    case 'mes-pasado':
      return rangoDeMes(mesAnterior(aMesLocal()))
    case 'trimestre':
      return trimestreDe()
    case 'trimestre-pasado':
      return trimestreAnterior()
    case 'anyo':
      return rangoDeAnyo(new Date().getFullYear())
    case 'personalizado':
      return { desde, hasta }
  }
}

function CopiaSeguridad() {
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState('')
  const [carpetas, setCarpetas] = useState<CarpetaCopia[]>([])
  const [diaUltimaCopia, setDiaUltimaCopia] = useState<string | null>(null)
  const [copiando, setCopiando] = useState(false)

  const [periodo, setPeriodo] = useState<OpcionPeriodo>('todo')
  const [desde, setDesde] = useState(() => rangoDeMes(aMesLocal()).desde)
  const [hasta, setHasta] = useState(() => aDiaLocal())

  const rango = rangoDelPeriodo(periodo, desde, hasta)
  const fechasAlReves = !!rango && rango.desde > rango.hasta
  const sufijo = rango && !fechasAlReves ? `-${rango.desde}_${rango.hasta}` : ''

  // Se recalcula solo cuando cambian el periodo o los datos del negocio
  const hojas = useLiveQuery(
    async () => (fechasAlReves ? [] : generarHojas(rango)),
    [rango?.desde, rango?.hasta, fechasAlReves],
    [],
  )

  const soportado = hayApiDeCarpetas()

  const refrescarEstado = async () => {
    setCarpetas(await listarCarpetas())
    setDiaUltimaCopia(await ultimaCopia())
  }

  useEffect(() => {
    refrescarEstado()
  }, [])

  const anadir = async () => {
    try {
      const nombre = await anadirCarpeta()
      if (!nombre) return
      await refrescarEstado()
      setMensaje(`Carpeta añadida: ${nombre}. Guardando la primera copia…`)
      await copiar()
    } catch (e) {
      // Si cierra el diálogo sin elegir nada, no es un error que haya que contar
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMensaje(e instanceof Error ? `Error: ${e.message}` : 'No se ha podido elegir la carpeta')
    }
  }

  const copiar = async () => {
    setCopiando(true)
    try {
      const { guardadas, fallidas, archivos } = await copiarAhora()
      await refrescarEstado()

      const partes: string[] = []
      if (guardadas.length > 0) {
        partes.push(`${archivos} archivos guardados en: ${guardadas.join(', ')}.`)
      }
      for (const f of fallidas) {
        partes.push(`No se pudo guardar en "${f.carpeta}" (${f.motivo}).`)
      }
      setMensaje(partes.join(' '))
    } catch (e) {
      setMensaje(e instanceof Error ? `Error: ${e.message}` : 'No se ha podido guardar la copia')
    } finally {
      setCopiando(false)
    }
  }

  const descargarJson = async () => {
    const copia = await exportarCopia()
    descargar(
      `copia-cafeteria-${aDiaLocal()}.json`,
      JSON.stringify(copia, null, 2),
      'application/json',
    )
    setMensaje('Copia descargada a la carpeta de Descargas.')
  }

  const descargarUnaHoja = (hoja: Hoja) => {
    descargar(hoja.nombre.replace('.csv', `${sufijo}.csv`), hoja.contenido)
    setMensaje(`Descargado "${hoja.nombre.replace('.csv', `${sufijo}.csv`)}" a la carpeta de Descargas.`)
  }

  const descargarTodo = () => {
    if (hojas.length === 0) return
    const nombre = `excel-cafeteria${sufijo || '-todo'}.zip`
    descargarBlob(
      nombre,
      crearZip(hojas.map((h) => ({ nombre: h.nombre, contenido: h.contenido }))),
    )
    setMensaje(`Descargado "${nombre}" con las ${hojas.length} hojas dentro.`)
  }

  const restaurar = async (archivo: File) => {
    if (
      !confirm(
        'Esto BORRA todo lo que hay ahora en la app y lo sustituye por el contenido de la copia.\n\n¿Seguro que quieres continuar?',
      )
    ) {
      return
    }
    try {
      await importarCopia(JSON.parse(await archivo.text()))
      setMensaje('Copia restaurada correctamente.')
    } catch (e) {
      setMensaje(e instanceof Error ? `Error: ${e.message}` : 'No se ha podido leer el archivo')
    }
  }

  const copiaDeHoy = diaUltimaCopia === aDiaLocal()
  const sinPermiso = carpetas.filter((c) => !c.permisoConcedido)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta className="lg:col-span-2">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-cafe-900">Copia automática diaria</h2>
          {carpetas.length > 0 &&
            (copiaDeHoy ? (
              <Etiqueta tono="verde">Copiado hoy</Etiqueta>
            ) : (
              <Etiqueta tono="ambar">Pendiente de hoy</Etiqueta>
            ))}
        </div>

        {!soportado ? (
          <p className="text-sm text-cafe-600">
            Este navegador no permite guardar copias solo. Abre la aplicación con <b>Chrome</b> o{' '}
            <b>Edge</b> para activarlo, o usa la descarga manual de aquí abajo.
          </p>
        ) : (
          <>
            <p className="mb-4 max-w-3xl text-sm text-cafe-600">
              Cada día, al abrir la aplicación, se guarda sola una copia completa de todo y las hojas
              de Excel en las carpetas que elijas aquí.
              <br />
              <b>Elige carpetas que ya se guarden en la nube</b>: la de <b>OneDrive</b> (que Windows
              trae puesta) o la de <b>Google Drive</b> si tienes instalado{' '}
              <i>Google Drive para ordenador</i>. Así la copia sube sola a internet y, aunque el
              ordenador se estropee, los datos siguen estando.
              <br />
              Puedes poner <b>más de una</b>: por ejemplo OneDrive y Google Drive a la vez.
            </p>

            {carpetas.length > 0 && (
              <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                {carpetas.map((c, i) => (
                  <li
                    key={`${c.nombre}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-cafe-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-cafe-900">{c.nombre}</div>
                      {!c.permisoConcedido && (
                        <div className="text-xs font-semibold text-amber-700">
                          Hay que volver a dar permiso
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`¿Dejar de guardar copias en "${c.nombre}"?`)) return
                        await quitarCarpeta(i)
                        await refrescarEstado()
                        setMensaje(`Ya no se guardarán copias en "${c.nombre}".`)
                      }}
                      aria-label={`Quitar ${c.nombre}`}
                      className="h-8 w-8 shrink-0 rounded-lg text-cafe-300 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {sinPermiso.length > 0 && (
              <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                El navegador ha olvidado el permiso de{' '}
                {sinPermiso.map((c) => `"${c.nombre}"`).join(' y ')}. Pulsa{' '}
                <b>Guardar copia ahora</b> y acepta para volver a activarlo.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton tono="principal" onClick={anadir}>
                {carpetas.length === 0 ? 'Elegir carpeta para las copias' : '+ Añadir otra carpeta'}
              </Boton>
              {carpetas.length > 0 && (
                <Boton tono="neutro" onClick={copiar} disabled={copiando}>
                  {copiando ? 'Guardando…' : 'Guardar copia ahora'}
                </Boton>
              )}
            </div>
          </>
        )}
      </Tarjeta>

      <Tarjeta className="lg:col-span-2">
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Descargar a Excel</h2>
        <p className="mb-4 max-w-3xl text-sm text-cafe-600">
          Elige el periodo y verás exactamente qué hojas salen y cuántas líneas lleva cada una.
          Puedes bajarlas una a una, o todas juntas en un único archivo comprimido.
        </p>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Periodo">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as OpcionPeriodo)}
              className={claseInput}
            >
              {OPCIONES_PERIODO.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </Campo>
          {periodo === 'personalizado' && (
            <>
              <Campo etiqueta="Desde">
                <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </Campo>
              <Campo etiqueta="Hasta">
                <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </Campo>
            </>
          )}
        </div>

        {fechasAlReves ? (
          <p className="rounded-xl bg-[#FFF7F5] px-4 py-3 text-sm font-semibold text-anular">
            La fecha de inicio es posterior a la de fin.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-cafe-500">
              {rango
                ? `Del ${formatearDia(rango.desde)} al ${formatearDia(rango.hasta)}`
                : 'Todo el histórico'}
            </p>

            <ul className="mb-4 divide-y divide-[#F4EBDD] overflow-hidden rounded-xl border border-borde bg-white">
              {hojas.map((hoja) => {
                const filas = filasDeLaHoja(hoja)
                return (
                  <li key={hoja.nombre} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">
                        {hoja.nombre.replace('.csv', '')}
                      </div>
                      <div className="text-xs font-semibold text-cafe-500">
                        {filas === 0
                          ? 'sin datos en este periodo'
                          : `${filas} ${filas === 1 ? 'línea' : 'líneas'}`}
                      </div>
                    </div>
                    <Boton
                      tono="neutro"
                      disabled={filas === 0}
                      onClick={() => descargarUnaHoja(hoja)}
                      className="!py-2 !text-xs"
                    >
                      Descargar
                    </Boton>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Boton
                tono="principal"
                onClick={descargarTodo}
                disabled={hojas.every((h) => filasDeLaHoja(h) === 0)}
              >
                Descargar las {hojas.length} hojas en un ZIP
              </Boton>
              <Boton tono="neutro" onClick={descargarJson}>
                Copia de seguridad (para restaurar)
              </Boton>
            </div>
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Restaurar una copia</h2>
        <p className="mb-4 text-sm text-cafe-600">
          Solo para cuando cambies de ordenador o hayas perdido los datos. Sustituye todo lo que haya
          ahora mismo en la aplicación.
        </p>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) restaurar(archivo)
            e.target.value = ''
          }}
        />
        <Boton tono="neutro" onClick={() => entrada.current?.click()}>
          Elegir archivo de copia…
        </Boton>
      </Tarjeta>

      {mensaje && (
        <div className="rounded-2xl bg-cafe-100 px-5 py-4 text-cafe-800 lg:col-span-2">{mensaje}</div>
      )}
    </div>
  )
}
