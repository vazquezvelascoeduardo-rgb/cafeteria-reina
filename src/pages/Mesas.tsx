import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { Boton, Etiqueta, Titulo, Vacio } from '../components/ui'
import { formatearEuros } from '../lib/dinero'
import { tiempoTranscurrido } from '../lib/fechas'
import { abrirTicketDeMesa, crearTicketSuelto } from '../lib/acciones'

export function Mesas({ onAbrirComanda }: { onAbrirComanda: (ticketId: number) => void }) {
  const mesas = useLiveQuery(() => db.mesas.orderBy('orden').toArray(), [], [])
  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])

  // Refresca el "hace X min" cada medio minuto
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const porMesa = new Map(abiertos.filter((t) => t.mesaId !== null).map((t) => [t.mesaId!, t]))
  const zonas = [...new Set(mesas.map((m) => m.zona))]
  const totalAbierto = abiertos.reduce((s, t) => s + t.total, 0)
  const ocupadas = abiertos.filter((t) => t.mesaId !== null).length

  const abrir = async (mesaId: number, nombre: string) => {
    onAbrirComanda(await abrirTicketDeMesa(mesaId, nombre))
  }

  return (
    <div>
      <Titulo
        extra={
          ocupadas > 0 ? (
            <div className="flex items-center gap-3 text-sm">
              <Etiqueta tono="ambar">
                {ocupadas} {ocupadas === 1 ? 'mesa ocupada' : 'mesas ocupadas'}
              </Etiqueta>
              <span className="font-bold text-cafe-800">{formatearEuros(totalAbierto)} sin cobrar</span>
            </div>
          ) : (
            <Etiqueta tono="verde">Todo cobrado</Etiqueta>
          )
        }
      >
        Mesas
      </Titulo>

      {mesas.length === 0 && (
        <Vacio>
          No hay mesas configuradas.
          <br />
          Ve a <b>Ajustes → Mesas</b> para crearlas.
        </Vacio>
      )}

      {zonas.map((zona) => (
        <section key={zona} className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-cafe-500 uppercase">{zona}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {mesas
              .filter((m) => m.zona === zona)
              .map((mesa) => {
                const ticket = porMesa.get(mesa.id!)
                const ocupada = !!ticket
                return (
                  <button
                    key={mesa.id}
                    onClick={() => abrir(mesa.id!, mesa.nombre)}
                    className={`flex h-32 flex-col justify-between rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                      ocupada
                        ? 'border-amber-400 bg-amber-50 hover:border-amber-500 hover:bg-amber-100'
                        : 'border-cafe-200 bg-white hover:border-cafe-400 hover:bg-cafe-50'
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-lg leading-tight font-bold text-cafe-900">{mesa.nombre}</span>
                      {ocupada && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                      )}
                    </div>
                    {ocupada ? (
                      <div>
                        <div className="text-2xl font-bold text-cafe-900">
                          {formatearEuros(ticket.total)}
                        </div>
                        <div className="text-xs text-cafe-500">
                          {ticket.lineas.reduce((s, l) => s + l.cantidad, 0)} art. ·{' '}
                          {tiempoTranscurrido(ticket.abiertoEn, ahora)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-cafe-400">Libre</span>
                    )}
                  </button>
                )
              })}
          </div>
        </section>
      ))}

      <div className="mt-8">
        <Boton tono="suave" onClick={async () => onAbrirComanda(await crearTicketSuelto())}>
          + Venta rápida sin mesa
        </Boton>
      </div>
    </div>
  )
}
