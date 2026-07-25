import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type Cliente, type Factura } from '../db'
import { Boton, Campo, Entrada, Modal, Titulo, Vacio, claseInput } from '../components/ui'
import { formatearEuros, formatearNumero } from '../lib/dinero'
import { formatearDia, trimestreAnterior, trimestreDe } from '../lib/fechas'
import {
  SinConsumosError,
  anularUltimaFactura,
  emitirFactura,
  ticketsPendientesDeFacturar,
} from '../lib/acciones'

export function Facturas({
  clienteInicial,
  onConsumido,
}: {
  clienteInicial: number | null
  onConsumido: () => void
}) {
  const facturas = useLiveQuery(
    async () => (await db.facturas.toArray()).sort((a, b) => b.creadaEn - a.creadaEn),
    [],
    [],
  )
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], [])
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])

  const [creando, setCreando] = useState(false)
  const [viendo, setViendo] = useState<Factura | null>(null)

  // Si llegamos desde "Hacer factura" en Clientes, abrimos el formulario directamente
  useEffect(() => {
    if (clienteInicial !== null) setCreando(true)
  }, [clienteInicial])

  const faltanDatosFiscales = !ajustes?.emisor.nombre || !ajustes?.emisor.nif

  return (
    <div>
      <Titulo
        extra={
          <Boton tono="principal" onClick={() => setCreando(true)} disabled={clientes.length === 0}>
            + Nueva factura
          </Boton>
        }
      >
        Facturas
      </Titulo>

      {faltanDatosFiscales && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <b>Antes de facturar:</b> rellena el nombre y el NIF de la cafetería en{' '}
          <b>Ajustes → Datos de la cafetería</b>. Sin eso la factura no es válida.
        </div>
      )}

      {facturas.length === 0 ? (
        <Vacio>
          Todavía no has emitido ninguna factura.
          <br />
          Las facturas llevan numeración correlativa y no se pueden modificar una vez emitidas.
        </Vacio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-cafe-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cafe-100 text-left text-xs tracking-wide text-cafe-600 uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">Número</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Periodo</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cafe-100">
              {facturas.map((f) => (
                <tr key={f.id} className="hover:bg-cafe-50">
                  <td className="px-4 py-3 font-bold text-cafe-900">{f.numero}</td>
                  <td className="px-4 py-3 tabular-nums">{formatearDia(f.fecha)}</td>
                  <td className="px-4 py-3">{f.cliente.nombre}</td>
                  <td className="px-4 py-3 text-cafe-500">
                    {formatearDia(f.desde)} – {formatearDia(f.hasta)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {formatearEuros(f.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Boton tono="suave" onClick={() => setViendo(f)}>
                      Ver e imprimir
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalNuevaFactura
        abierto={creando}
        clientes={clientes}
        clienteInicial={clienteInicial}
        onCerrar={() => {
          setCreando(false)
          onConsumido()
        }}
        onEmitida={(f) => {
          setCreando(false)
          onConsumido()
          setViendo(f)
        }}
      />

      {viendo && (
        <VistaFactura
          factura={viendo}
          onCerrar={() => setViendo(null)}
          onAnular={async () => {
            try {
              await anularUltimaFactura(viendo.id!)
              setViendo(null)
            } catch (e) {
              alert(e instanceof Error ? e.message : 'No se ha podido anular')
            }
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ModalNuevaFactura({
  abierto,
  clientes,
  clienteInicial,
  onCerrar,
  onEmitida,
}: {
  abierto: boolean
  clientes: Cliente[]
  clienteInicial: number | null
  onCerrar: () => void
  onEmitida: (f: Factura) => void
}) {
  const anterior = trimestreAnterior()
  const actual = trimestreDe()

  const [clienteId, setClienteId] = useState<number | null>(clienteInicial)
  const [desde, setDesde] = useState(anterior.desde)
  const [hasta, setHasta] = useState(anterior.hasta)
  const [observaciones, setObservaciones] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)

  useEffect(() => {
    if (clienteInicial !== null) setClienteId(clienteInicial)
  }, [clienteInicial])

  const cliente = clientes.find((c) => c.id === clienteId) ?? null

  const previsualizacion = useLiveQuery(
    async () => (clienteId === null ? [] : ticketsPendientesDeFacturar(clienteId, desde, hasta)),
    [clienteId, desde, hasta],
    [],
  )

  const total = previsualizacion.reduce((s, t) => s + t.total, 0)
  const puedeEmitir = cliente !== null && previsualizacion.length > 0 && !emitiendo

  const emitir = async () => {
    if (!cliente) return
    setEmitiendo(true)
    try {
      const factura = await emitirFactura({ cliente, desde, hasta, observaciones })
      onEmitida(factura)
    } catch (e) {
      alert(
        e instanceof SinConsumosError
          ? 'No hay consumos pendientes de facturar en ese periodo.'
          : e instanceof Error
            ? e.message
            : 'No se ha podido emitir la factura',
      )
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nueva factura" ancho="max-w-2xl">
      <div className="grid gap-4">
        <Campo etiqueta="Cliente">
          <select
            value={clienteId ?? ''}
            onChange={(e) => setClienteId(e.target.value === '' ? null : Number(e.target.value))}
            className={claseInput}
          >
            <option value="">Elige un cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <div>
          <span className="mb-2 block text-sm font-semibold text-cafe-700">Periodo a facturar</span>
          <div className="mb-3 flex flex-wrap gap-2">
            <Boton
              tono="suave"
              onClick={() => {
                setDesde(anterior.desde)
                setHasta(anterior.hasta)
              }}
            >
              Trimestre pasado ({anterior.etiqueta})
            </Boton>
            <Boton
              tono="suave"
              onClick={() => {
                setDesde(actual.desde)
                setHasta(actual.hasta)
              }}
            >
              Trimestre en curso ({actual.etiqueta})
            </Boton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde">
              <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Campo>
            <Campo etiqueta="Hasta">
              <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Campo>
          </div>
        </div>

        <Campo etiqueta="Observaciones (opcional)" ayuda="Sale impreso al pie de la factura">
          <Entrada
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Pago por transferencia a 30 días"
          />
        </Campo>

        <div className="rounded-2xl bg-cafe-100 p-4">
          {clienteId === null ? (
            <p className="text-sm text-cafe-600">Elige un cliente para ver qué se va a facturar.</p>
          ) : previsualizacion.length === 0 ? (
            <p className="text-sm text-cafe-600">
              Este cliente no tiene consumos pendientes entre esas dos fechas.
            </p>
          ) : (
            <>
              <div className="mb-1 text-sm text-cafe-600">
                Se {previsualizacion.length === 1 ? 'facturará' : 'facturarán'}{' '}
                <b>{previsualizacion.length}</b>{' '}
                {previsualizacion.length === 1 ? 'consumo' : 'consumos'} de {formatearDia(desde)} a{' '}
                {formatearDia(hasta)}
              </div>
              <div className="text-3xl font-bold tabular-nums text-cafe-900">{formatearEuros(total)}</div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Boton tono="principal" disabled={!puedeEmitir} onClick={emitir} className="!py-4 !text-lg">
            {emitiendo ? 'Emitiendo…' : 'Emitir factura'}
          </Boton>
          <Boton tono="neutro" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function VistaFactura({
  factura,
  onCerrar,
  onAnular,
}: {
  factura: Factura
  onCerrar: () => void
  onAnular: () => void
}) {
  const { emisor, cliente } = factura

  return (
    <div className="overlay-factura fixed inset-0 z-50 overflow-y-auto bg-cafe-900/50 p-4">
      <div className="no-imprimir mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2">
        <Boton tono="neutro" onClick={onCerrar}>
          ← Volver
        </Boton>
        <Boton tono="principal" onClick={() => window.print()}>
          Imprimir / Guardar en PDF
        </Boton>
        <Boton
          tono="neutro"
          className="ml-auto !text-red-600"
          onClick={() => {
            if (
              confirm(
                'Anular esta factura y devolver los consumos a "pendientes de facturar".\n\nSolo se puede hacer con la última factura emitida. ¿Continuar?',
              )
            ) {
              onAnular()
            }
          }}
        >
          Anular factura
        </Boton>
      </div>

      <div className="hoja-factura mx-auto max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-black shadow-2xl">
        <header className="mb-8 flex justify-between gap-8">
          <div>
            <h1 className="mb-1 text-xl font-bold">{emisor.nombre || '(Falta el nombre)'}</h1>
            <p>NIF: {emisor.nif || '(Falta el NIF)'}</p>
            {emisor.direccion && <p>{emisor.direccion}</p>}
            {(emisor.cp || emisor.ciudad) && (
              <p>
                {emisor.cp} {emisor.ciudad}
                {emisor.provincia && ` (${emisor.provincia})`}
              </p>
            )}
            {emisor.telefono && <p>Tel. {emisor.telefono}</p>}
            {emisor.email && <p>{emisor.email}</p>}
          </div>
          <div className="shrink-0 text-right">
            <div className="mb-1 text-2xl font-bold tracking-wide uppercase">Factura</div>
            <table className="ml-auto text-right">
              <tbody>
                <tr>
                  <td className="pr-3 text-gray-500">Número</td>
                  <td className="font-bold">{factura.numero}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-gray-500">Fecha</td>
                  <td>{formatearDia(factura.fecha)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="mb-6 border border-gray-300 p-4">
          <div className="mb-1 text-[11px] font-bold tracking-wider text-gray-500 uppercase">
            Destinatario
          </div>
          <p className="font-bold">{cliente.nombre}</p>
          {cliente.nif && <p>NIF: {cliente.nif}</p>}
          {cliente.direccion && <p>{cliente.direccion}</p>}
          {(cliente.cp || cliente.ciudad) && (
            <p>
              {cliente.cp} {cliente.ciudad}
              {cliente.provincia && ` (${cliente.provincia})`}
            </p>
          )}
        </section>

        <p className="mb-4">
          Consumiciones realizadas del <b>{formatearDia(factura.desde)}</b> al{' '}
          <b>{formatearDia(factura.hasta)}</b>.
        </p>

        <table className="mb-6 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-gray-800 text-left text-[11px] tracking-wider uppercase">
              <th className="py-2 pr-2 font-bold">Concepto</th>
              <th className="w-16 py-2 text-right font-bold">Uds.</th>
              <th className="w-24 py-2 text-right font-bold">Precio</th>
              <th className="w-14 py-2 text-right font-bold">IVA</th>
              <th className="w-28 py-2 text-right font-bold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {factura.lineas.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 pr-2">{l.descripcion}</td>
                <td className="py-1.5 text-right tabular-nums">{l.cantidad}</td>
                <td className="py-1.5 text-right tabular-nums">{formatearNumero(l.precio)}</td>
                <td className="py-1.5 text-right tabular-nums">{l.iva} %</td>
                <td className="py-1.5 text-right tabular-nums">{formatearNumero(l.importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="w-80 border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-[11px] tracking-wider text-gray-500 uppercase">
                <th className="py-1 text-left font-bold">Tipo</th>
                <th className="py-1 text-right font-bold">Base imponible</th>
                <th className="py-1 text-right font-bold">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {factura.desglose.map((d) => (
                <tr key={d.iva} className="border-b border-gray-200">
                  <td className="py-1.5 tabular-nums">IVA {d.iva} %</td>
                  <td className="py-1.5 text-right tabular-nums">{formatearNumero(d.base)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatearNumero(d.cuota)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1.5">Subtotales</td>
                <td className="py-1.5 text-right tabular-nums">{formatearNumero(factura.base)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatearNumero(factura.cuota)}</td>
              </tr>
              <tr className="border-t-2 border-gray-800">
                <td className="py-2 text-base font-bold" colSpan={2}>
                  TOTAL FACTURA
                </td>
                <td className="py-2 text-right text-base font-bold tabular-nums">
                  {formatearEuros(factura.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {factura.observaciones && (
          <p className="mt-8 border-t border-gray-300 pt-3 text-[12px]">{factura.observaciones}</p>
        )}

        <p className="mt-10 text-[10px] text-gray-500">
          Factura expedida conforme al Real Decreto 1619/2012, por el que se aprueba el Reglamento de
          obligaciones de facturación.
        </p>
      </div>
    </div>
  )
}
