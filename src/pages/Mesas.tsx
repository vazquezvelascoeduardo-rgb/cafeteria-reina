import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { Boton, Importe, Rotulo, Vacio } from '../components/ui'
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

  const abrir = async (mesaId: number, nombre: string) => {
    onAbrirComanda(await abrirTicketDeMesa(mesaId, nombre))
  }

  return (
    <div>
      {mesas.length === 0 && (
        <Vacio>
          No hay mesas configuradas.
          <br />
          Ve a <b>Ajustes → Mesas</b> para crearlas.
        </Vacio>
      )}

      {zonas.map((zona) => {
        const deLaZona = mesas.filter((m) => m.zona === zona)
        const ocupadas = deLaZona.filter((m) => porMesa.has(m.id!)).length

        return (
          <section key={zona} className="mb-7">
            <Rotulo
              extra={
                ocupadas === 0
                  ? `${deLaZona.length} ${deLaZona.length === 1 ? 'libre' : 'libres'}`
                  : `${ocupadas} de ${deLaZona.length} ${ocupadas === 1 ? 'ocupada' : 'ocupadas'}`
              }
            >
              {zona}
            </Rotulo>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {deLaZona.map((mesa) => {
                const ticket = porMesa.get(mesa.id!)
                const ocupada = !!ticket

                return (
                  <button
                    key={mesa.id}
                    onClick={() => abrir(mesa.id!, mesa.nombre)}
                    className={`flex h-[124px] flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(51,32,15,.13)] ${
                      ocupada
                        ? 'border-[#F0DCA6] bg-[#FFFBF0]'
                        : 'border-borde bg-white hover:border-oro-medio'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-[16.5px] font-extrabold">{mesa.nombre}</span>
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          ocupada ? 'latido bg-[#E0A21C]' : 'bg-cafe-200'
                        }`}
                      />
                    </div>

                    {ocupada ? (
                      <div>
                        <Importe className="block text-[27px] leading-none">
                          {formatearEuros(ticket.total)}
                        </Importe>
                        <div className="mt-1.5 text-[12.5px] font-semibold text-cafe-500">
                          {ticket.lineas.reduce((s, l) => s + l.cantidad, 0)} art. ·{' '}
                          {tiempoTranscurrido(ticket.abiertoEn, ahora)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-cafe-400">Libre</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="mt-8">
        <Boton tono="neutro" onClick={async () => onAbrirComanda(await crearTicketSuelto())}>
          + Venta rápida sin mesa
        </Boton>
      </div>
    </div>
  )
}
