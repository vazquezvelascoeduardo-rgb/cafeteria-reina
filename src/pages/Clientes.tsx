import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Cliente } from '../db'
import { BarraAcciones, Boton, Campo, Entrada, Etiqueta, Modal, Tarjeta, Vacio } from '../components/ui'
import { formatearEuros } from '../lib/dinero'
import { formatearDia } from '../lib/fechas'

const CLIENTE_VACIO: Cliente = {
  nombre: '',
  nif: '',
  direccion: '',
  cp: '',
  ciudad: '',
  provincia: '',
  email: '',
  telefono: '',
  notas: '',
}

export function Clientes({ onFacturar }: { onFacturar: (clienteId: number) => void }) {
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], [])
  const aCuenta = useLiveQuery(() => db.tickets.where('estado').equals('a_cuenta').toArray(), [], [])

  const [editando, setEditando] = useState<Cliente | null>(null)
  const [detalle, setDetalle] = useState<Cliente | null>(null)

  const pendientePorCliente = new Map<number, { total: number; tickets: number }>()
  for (const t of aCuenta) {
    if (t.facturaId !== null || t.clienteId === null) continue
    const actual = pendientePorCliente.get(t.clienteId) ?? { total: 0, tickets: 0 }
    pendientePorCliente.set(t.clienteId, {
      total: actual.total + t.total,
      tickets: actual.tickets + 1,
    })
  }

  return (
    <div>
      <BarraAcciones>
        <Boton tono="principal" onClick={() => setEditando({ ...CLIENTE_VACIO })}>
          + Nuevo cliente
        </Boton>
      </BarraAcciones>

      <p className="mb-5 max-w-3xl text-cafe-600">
        Aquí van los clientes que no pagan en el momento, sino que consumen a cuenta y luego reciben una
        factura. Sus datos fiscales son los que saldrán impresos en la factura.
      </p>

      {clientes.length === 0 ? (
        <Vacio>
          Todavía no hay ningún cliente.
          <br />
          Crea el primero con el botón <b>Nuevo cliente</b>.
        </Vacio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clientes.map((c) => {
            const pendiente = pendientePorCliente.get(c.id!)
            return (
              <Tarjeta key={c.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-cafe-900">{c.nombre}</h3>
                    <p className="text-sm text-cafe-500">{c.nif || 'Sin NIF'}</p>
                  </div>
                  {pendiente ? (
                    <Etiqueta tono="ambar">{pendiente.tickets} sin facturar</Etiqueta>
                  ) : (
                    <Etiqueta tono="verde">Al día</Etiqueta>
                  )}
                </div>

                <div className="mb-4 rounded-xl bg-cafe-50 px-4 py-3">
                  <div className="text-xs text-cafe-500">Pendiente de facturar</div>
                  <div className="text-2xl font-bold tabular-nums text-cafe-900">
                    {formatearEuros(pendiente?.total ?? 0)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Boton tono="principal" onClick={() => onFacturar(c.id!)} disabled={!pendiente}>
                    Hacer factura
                  </Boton>
                  <Boton tono="neutro" onClick={() => setDetalle(c)}>
                    Ver consumos
                  </Boton>
                  <Boton tono="neutro" onClick={() => setEditando(c)}>
                    Editar
                  </Boton>
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      <ModalCliente
        cliente={editando}
        onCerrar={() => setEditando(null)}
        onGuardar={async (c) => {
          if (c.id === undefined) {
            await db.clientes.add(c)
          } else {
            await db.clientes.put(c)
          }
          setEditando(null)
        }}
        onBorrar={async (id) => {
          const conConsumos = await db.tickets.where({ clienteId: id }).count()
          if (conConsumos > 0) {
            alert('No se puede borrar: este cliente tiene consumos registrados en el historial.')
            return
          }
          await db.clientes.delete(id)
          setEditando(null)
        }}
      />

      <ModalConsumos cliente={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}

function ModalCliente({
  cliente,
  onCerrar,
  onGuardar,
  onBorrar,
}: {
  cliente: Cliente | null
  onCerrar: () => void
  onGuardar: (c: Cliente) => void
  onBorrar: (id: number) => void
}) {
  const [borrador, setBorrador] = useState<Cliente>(CLIENTE_VACIO)
  const [clienteCargado, setClienteCargado] = useState<Cliente | null>(null)

  // Carga el cliente en el formulario cuando cambia el que se está editando
  if (cliente !== clienteCargado) {
    setClienteCargado(cliente)
    setBorrador(cliente ?? CLIENTE_VACIO)
  }

  const set = (campo: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBorrador((b) => ({ ...b, [campo]: e.target.value }))

  const valido = borrador.nombre.trim() !== ''

  return (
    <Modal
      abierto={cliente !== null}
      onCerrar={onCerrar}
      titulo={cliente?.id === undefined ? 'Nuevo cliente' : 'Editar cliente'}
      ancho="max-w-2xl"
    >
      <div className="grid gap-3">
        <Campo etiqueta="Nombre o razón social" ayuda="Aparecerá en la factura">
          <Entrada value={borrador.nombre} onChange={set('nombre')} placeholder="Ej. Talleres Pérez S.L." />
        </Campo>
        <Campo etiqueta="NIF / CIF">
          <Entrada value={borrador.nif} onChange={set('nif')} placeholder="B12345678" />
        </Campo>
        <Campo etiqueta="Dirección">
          <Entrada value={borrador.direccion} onChange={set('direccion')} placeholder="Calle, número" />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Código postal">
            <Entrada value={borrador.cp} onChange={set('cp')} />
          </Campo>
          <Campo etiqueta="Población">
            <Entrada value={borrador.ciudad} onChange={set('ciudad')} />
          </Campo>
          <Campo etiqueta="Provincia">
            <Entrada value={borrador.provincia} onChange={set('provincia')} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Teléfono">
            <Entrada value={borrador.telefono} onChange={set('telefono')} />
          </Campo>
          <Campo etiqueta="Email">
            <Entrada value={borrador.email} onChange={set('email')} type="email" />
          </Campo>
        </div>
        <Campo etiqueta="Notas" ayuda="Para ti, no sale en la factura">
          <Entrada value={borrador.notas} onChange={set('notas')} />
        </Campo>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Boton tono="principal" disabled={!valido} onClick={() => onGuardar(borrador)}>
            Guardar cliente
          </Boton>
          <Boton tono="neutro" onClick={onCerrar}>
            Cancelar
          </Boton>
          {borrador.id !== undefined && (
            <Boton
              tono="neutro"
              className="ml-auto !text-red-600"
              onClick={() => {
                if (confirm(`¿Borrar a ${borrador.nombre}?`)) onBorrar(borrador.id!)
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

function ModalConsumos({ cliente, onCerrar }: { cliente: Cliente | null; onCerrar: () => void }) {
  const tickets = useLiveQuery(
    async () => (cliente?.id === undefined ? [] : db.tickets.where({ clienteId: cliente.id }).toArray()),
    [cliente?.id],
    [],
  )

  const pendientes = tickets
    .filter((t) => t.facturaId === null && t.estado === 'a_cuenta')
    .sort((a, b) => (b.cerradoEn ?? 0) - (a.cerradoEn ?? 0))
  const facturados = tickets
    .filter((t) => t.facturaId !== null)
    .sort((a, b) => (b.cerradoEn ?? 0) - (a.cerradoEn ?? 0))

  return (
    <Modal
      abierto={cliente !== null}
      onCerrar={onCerrar}
      titulo={`Consumos de ${cliente?.nombre ?? ''}`}
      ancho="max-w-2xl"
    >
      <h3 className="mb-2 font-bold text-cafe-800">
        Pendientes de facturar ({pendientes.length}) ·{' '}
        {formatearEuros(pendientes.reduce((s, t) => s + t.total, 0))}
      </h3>
      {pendientes.length === 0 ? (
        <p className="mb-6 text-sm text-cafe-500">No hay consumos pendientes.</p>
      ) : (
        <ul className="mb-6 divide-y divide-cafe-100 overflow-hidden rounded-xl border border-cafe-200 bg-white">
          {pendientes.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div>
                <div className="font-semibold text-cafe-900">{formatearDia(t.dia)}</div>
                <div className="text-xs text-cafe-500">
                  {t.mesaNombre} · {t.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join(', ')}
                </div>
              </div>
              <span className="shrink-0 font-bold tabular-nums">{formatearEuros(t.total)}</span>
            </li>
          ))}
        </ul>
      )}

      {facturados.length > 0 && (
        <>
          <h3 className="mb-2 font-bold text-cafe-800">Ya facturados ({facturados.length})</h3>
          <ul className="max-h-56 divide-y divide-cafe-100 overflow-y-auto rounded-xl border border-cafe-200 bg-white text-sm">
            {facturados.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2 text-cafe-500">
                <span>
                  {formatearDia(t.dia)} · {t.mesaNombre}
                </span>
                <span className="tabular-nums">{formatearEuros(t.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
