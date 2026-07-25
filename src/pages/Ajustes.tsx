import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, type Categoria, type DatosEmisor, type Mesa, type Producto } from '../db'
import { Boton, Campo, Entrada, Modal, Tarjeta, Titulo, Vacio, claseInput } from '../components/ui'
import { eurosACentimos, formatearEuros, formatearNumero } from '../lib/dinero'
import { exportarCopia, importarCopia } from '../lib/acciones'
import { aDiaLocal } from '../lib/fechas'

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
      <Titulo>Ajustes</Titulo>

      <div className="mb-6 flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              seccion === s.id ? 'bg-cafe-600 text-white' : 'bg-white text-cafe-700 hover:bg-cafe-100'
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
              <option value={21}>21 %</option>
              <option value={4}>4 %</option>
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

function CopiaSeguridad() {
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState('')

  const descargar = async () => {
    const copia = await exportarCopia()
    const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `copia-cafeteria-${aDiaLocal()}.json`
    enlace.click()
    URL.revokeObjectURL(url)
    setMensaje('Copia descargada. Guárdala en un pendrive o en el correo.')
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Guardar una copia</h2>
        <p className="mb-4 text-sm text-cafe-600">
          Los datos viven dentro de este ordenador. Descarga una copia de vez en cuando (una vez por
          semana está bien) y guárdala en un pendrive o mándatela por correo. Si el ordenador se
          estropea, con ese archivo lo recuperas todo.
        </p>
        <Boton tono="principal" onClick={descargar}>
          Descargar copia de seguridad
        </Boton>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-1 text-lg font-bold text-cafe-900">Restaurar una copia</h2>
        <p className="mb-4 text-sm text-cafe-600">
          Solo para cuando cambies de ordenador o hayas perdido los datos. Sustituye todo lo que haya
          ahora mismo en la app.
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
