import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { Boton, Etiqueta, Tarjeta, Vacio } from '../components/ui'
import { desglosePago, formatearEuros } from '../lib/dinero'
import { aDiaLocal, etiquetaDiaCorta, formatearDia, ultimosDias } from '../lib/fechas'
import { listarCarpetas, ultimaCopia } from '../lib/copiaAutomatica'

export type Destino = 'mesas' | 'caja' | 'clientes' | 'facturas' | 'informes' | 'ajustes'

function saludo(): string {
  const hora = new Date().getHours()
  if (hora < 6) return 'Buenas noches'
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function Inicio({ onIr }: { onIr: (destino: Destino) => void }) {
  const hoy = aDiaLocal()
  const semana = ultimosDias(7)
  const ayer = ultimosDias(2)[0]

  const ticketsSemana = useLiveQuery(
    () => db.tickets.where('dia').between(semana[0], hoy, true, true).toArray(),
    [semana[0], hoy],
    [],
  )
  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])
  const aCuenta = useLiveQuery(() => db.tickets.where('estado').equals('a_cuenta').toArray(), [], [])
  const clientes = useLiveQuery(() => db.clientes.toArray(), [], [])
  const ajustes = useLiveQuery(() => db.ajustes.get(1), [])

  const [copia, setCopia] = useState<{ carpetas: number; sinPermiso: number; dia: string | null }>({
    carpetas: 0,
    sinPermiso: 0,
    dia: null,
  })

  useEffect(() => {
    ;(async () => {
      const carpetas = await listarCarpetas()
      setCopia({
        carpetas: carpetas.length,
        sinPermiso: carpetas.filter((c) => !c.permisoConcedido).length,
        dia: await ultimaCopia(),
      })
    })()
  }, [])

  const deHoy = ticketsSemana.filter((t) => t.dia === hoy)
  const deAyer = ticketsSemana.filter((t) => t.dia === ayer)

  const sumar = (lista: typeof deHoy) =>
    lista.reduce(
      (suma, t) => {
        const d = desglosePago(t)
        return { efectivo: suma.efectivo + d.efectivo, tarjeta: suma.tarjeta + d.tarjeta }
      },
      { efectivo: 0, tarjeta: 0 },
    )

  const hoyPorVia = sumar(deHoy)
  const ayerPorVia = sumar(deAyer)
  const efectivoHoy = hoyPorVia.efectivo
  const tarjetaHoy = hoyPorVia.tarjeta
  const cobradoHoy = efectivoHoy + tarjetaHoy
  const cobradoAyer = ayerPorVia.efectivo + ayerPorVia.tarjeta

  const porDia = new Map<string, number>()
  for (const t of ticketsSemana) porDia.set(t.dia, (porDia.get(t.dia) ?? 0) + t.total)
  const maximoSemana = Math.max(1, ...semana.map((d) => porDia.get(d) ?? 0))

  const diasConDatos = semana.filter((d) => (porDia.get(d) ?? 0) > 0)
  const mediaSemana =
    diasConDatos.length === 0
      ? 0
      : Math.round(diasConDatos.reduce((s, d) => s + (porDia.get(d) ?? 0), 0) / diasConDatos.length)

  const diferencia = cobradoHoy - cobradoAyer
  const sinCobrar = abiertos.reduce((s, t) => s + t.total, 0)

  const pendientes = aCuenta.filter((t) => t.facturaId === null)
  const totalPendiente = pendientes.reduce((s, t) => s + t.total, 0)
  const clientesPendientes = new Set(pendientes.map((t) => t.clienteId)).size

  const faltanDatosFiscales = ajustes !== undefined && (!ajustes.emisor.nombre || !ajustes.emisor.nif)
  const copiaAlDia = copia.dia === hoy

  return (
    <div>
      <h1 className="mb-5 font-serif text-3xl font-semibold">{saludo()}</h1>

      {/* ------------------------------ Avisos ------------------------------ */}
      <div className="mb-6 grid gap-3">
        {faltanDatosFiscales && (
          <Aviso
            tono="ambar"
            texto="Faltan el nombre y el NIF de la cafetería. Sin ellos no se pueden emitir facturas válidas."
            accion="Rellenarlos"
            onAccion={() => onIr('ajustes')}
          />
        )}
        {copia.carpetas === 0 && (
          <Aviso
            tono="ambar"
            texto="No hay ninguna copia de seguridad automática configurada. Si este ordenador falla, se perdería todo."
            accion="Configurarla"
            onAccion={() => onIr('ajustes')}
          />
        )}
        {copia.sinPermiso > 0 && (
          <Aviso
            tono="rojo"
            texto="El navegador ha olvidado el permiso de una carpeta de copias y hoy no se ha podido guardar."
            accion="Arreglarlo"
            onAccion={() => onIr('ajustes')}
          />
        )}
        {abiertos.length > 0 && (
          <Aviso
            tono="azul"
            texto={`Hay ${abiertos.length} ${abiertos.length === 1 ? 'mesa abierta' : 'mesas abiertas'} con ${formatearEuros(sinCobrar)} sin cobrar.`}
            accion="Ver mesas"
            onAccion={() => onIr('mesas')}
          />
        )}
      </div>

      {/* ------------------------------- Hoy -------------------------------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-cafe-600 p-6 text-white">
          <div className="text-sm opacity-80">Cobrado hoy</div>
          <div className="text-5xl font-bold tabular-nums">{formatearEuros(cobradoHoy)}</div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm opacity-90">
            <span>Efectivo: {formatearEuros(efectivoHoy)}</span>
            <span>Tarjeta: {formatearEuros(tarjetaHoy)}</span>
            <span>
              {deHoy.length} {deHoy.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>
          {cobradoAyer > 0 && (
            <div className="mt-3 border-t border-white/20 pt-3 text-sm">
              {diferencia >= 0 ? '▲' : '▼'} {formatearEuros(Math.abs(diferencia))}{' '}
              {diferencia >= 0 ? 'más' : 'menos'} que ayer ({formatearEuros(cobradoAyer)})
            </div>
          )}
        </div>

        <Tarjeta>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-bold text-cafe-900">Últimos 7 días</h2>
            <span className="text-sm text-cafe-500">
              media {formatearEuros(mediaSemana)} al día
            </span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {semana.map((d) => {
              const importe = porDia.get(d) ?? 0
              return (
                <div key={d} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t transition-colors ${
                        d === hoy ? 'bg-cafe-600' : 'bg-cafe-300 group-hover:bg-cafe-400'
                      }`}
                      style={{ height: `${Math.max(3, (importe / maximoSemana) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] whitespace-nowrap text-cafe-400">
                    {etiquetaDiaCorta(d)}
                  </span>
                </div>
              )
            })}
          </div>
        </Tarjeta>
      </div>

      {/* --------------------------- Otras cosas ---------------------------- */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tarjeta>
          <h2 className="mb-3 font-bold text-cafe-900">Pendiente de facturar</h2>
          {pendientes.length === 0 ? (
            <p className="text-sm text-cafe-500">
              {clientes.length === 0
                ? 'Todavía no hay clientes a cuenta.'
                : 'Ningún cliente tiene consumos pendientes.'}
            </p>
          ) : (
            <>
              <div className="text-3xl font-bold tabular-nums text-cafe-900">
                {formatearEuros(totalPendiente)}
              </div>
              <p className="mt-1 mb-4 text-sm text-cafe-500">
                de {clientesPendientes} {clientesPendientes === 1 ? 'cliente' : 'clientes'}, en{' '}
                {pendientes.length} {pendientes.length === 1 ? 'consumo' : 'consumos'}
              </p>
              <Boton tono="principal" onClick={() => onIr('facturas')}>
                Hacer una factura
              </Boton>
            </>
          )}
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-3 font-bold text-cafe-900">Copia de seguridad</h2>
          {copia.carpetas === 0 ? (
            <p className="text-sm text-cafe-500">Sin configurar.</p>
          ) : (
            <>
              <div className="mb-2">
                {copiaAlDia ? (
                  <Etiqueta tono="verde">Guardada hoy</Etiqueta>
                ) : (
                  <Etiqueta tono="ambar">Pendiente</Etiqueta>
                )}
              </div>
              <p className="text-sm text-cafe-500">
                {copia.dia ? `Última copia: ${formatearDia(copia.dia)}.` : 'Aún sin copias.'}
                <br />
                {copia.carpetas} {copia.carpetas === 1 ? 'carpeta' : 'carpetas'} configuradas.
              </p>
            </>
          )}
          <div className="mt-4">
            <Boton tono="neutro" onClick={() => onIr('ajustes')}>
              Ajustes de copia
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-3 font-bold text-cafe-900">Ir a…</h2>
          <div className="grid grid-cols-2 gap-2">
            <Boton tono="suave" onClick={() => onIr('mesas')}>
              Mesas
            </Boton>
            <Boton tono="suave" onClick={() => onIr('caja')}>
              Caja
            </Boton>
            <Boton tono="suave" onClick={() => onIr('informes')}>
              Informes
            </Boton>
            <Boton tono="suave" onClick={() => onIr('clientes')}>
              Clientes
            </Boton>
          </div>
        </Tarjeta>
      </div>

      {ticketsSemana.length === 0 && (
        <div className="mt-6">
          <Vacio>
            Todavía no hay ventas registradas esta semana.
            <br />
            Empieza abriendo una mesa desde la pestaña <b>Mesas</b>.
          </Vacio>
        </div>
      )}
    </div>
  )
}

function Aviso({
  tono,
  texto,
  accion,
  onAccion,
}: {
  tono: 'ambar' | 'rojo' | 'azul'
  texto: string
  accion: string
  onAccion: () => void
}) {
  const tonos = {
    ambar: 'border-amber-300 bg-amber-50 text-amber-900',
    rojo: 'border-red-300 bg-red-50 text-red-900',
    azul: 'border-sky-300 bg-sky-50 text-sky-900',
  }
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 ${tonos[tono]}`}
    >
      <span className="text-sm font-medium">{texto}</span>
      <Boton tono="neutro" onClick={onAccion} className="!py-2 !text-sm">
        {accion}
      </Boton>
    </div>
  )
}
