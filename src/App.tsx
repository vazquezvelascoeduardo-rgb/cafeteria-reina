import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { Emblema } from './components/Logo'
import { Inicio } from './pages/Inicio'
import { Mesas } from './pages/Mesas'
import { Comanda } from './pages/Comanda'
import { Caja } from './pages/Caja'
import { Tickets } from './pages/Tickets'
import { Clientes } from './pages/Clientes'
import { Facturas } from './pages/Facturas'
import { Informes } from './pages/Informes'
import { Ajustes } from './pages/Ajustes'
import { formatearEuros } from './lib/dinero'
import { copiaAutomaticaSiToca } from './lib/copiaAutomatica'

type Vista =
  | 'inicio'
  | 'mesas'
  | 'caja'
  | 'tickets'
  | 'clientes'
  | 'facturas'
  | 'informes'
  | 'ajustes'

const SECCIONES: { id: Vista; nombre: string; sub: string; icono: string }[] = [
  {
    id: 'inicio',
    nombre: 'Inicio',
    sub: 'Cómo va el día',
    icono: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-4v-7H8v7H4a1 1 0 0 1-1-1z',
  },
  {
    id: 'mesas',
    nombre: 'Mesas',
    sub: 'Toca una mesa para tomar nota',
    icono: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  },
  {
    id: 'caja',
    nombre: 'Caja',
    sub: 'Lo cobrado y el cuadre del cajón',
    icono: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M15.5 9.5A4 4 0 1 0 15.5 15M7 11h6M7 13.5h6',
  },
  {
    id: 'tickets',
    nombre: 'Tickets',
    sub: 'Todo lo cobrado, ticket a ticket',
    icono: 'M6 2h12a1 1 0 0 1 1 1v18l-2.3-1.4-2.3 1.4-2.4-1.4L9.6 21l-2.3-1.4L5 21V3a1 1 0 0 1 1-1M9 8h6M9 12h6',
  },
  {
    id: 'clientes',
    nombre: 'Clientes',
    sub: 'Quien consume a cuenta',
    icono: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  },
  {
    id: 'facturas',
    nombre: 'Facturas',
    sub: 'Emitidas y por emitir',
    icono: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  },
  {
    id: 'informes',
    nombre: 'Informes',
    sub: 'Cómo va el negocio',
    icono: 'M3 3v18h18M7 15v3M12 9v9M17 5v13',
  },
  {
    id: 'ajustes',
    nombre: 'Ajustes',
    sub: 'La carta, los datos y las copias',
    icono: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  },
]

export default function App() {
  const [vista, setVista] = useState<Vista>('mesas')
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [clienteAFacturar, setClienteAFacturar] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => new Date())

  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])
  const ticket = useLiveQuery(
    async () => (ticketId === null ? null : ((await db.tickets.get(ticketId)) ?? null)),
    [ticketId],
  )
  const totalAbierto = abiertos.reduce((s, t) => s + t.total, 0)

  // Copia del día a las carpetas elegidas, en cuanto se abre la aplicación
  useEffect(() => {
    copiaAutomaticaSiToca()
  }, [])

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 20000)
    return () => clearInterval(id)
  }, [])

  const ir = (destino: Vista) => {
    setTicketId(null)
    setVista(destino)
  }

  const seccion = SECCIONES.find((s) => s.id === vista)!
  const enComanda = ticketId !== null
  const titulo = enComanda ? (ticket?.mesaNombre ?? 'Comanda') : seccion.nombre
  const subtitulo = enComanda ? 'Toca los productos para añadirlos' : seccion.sub

  const hora = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const fecha = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex h-full flex-col-reverse md:flex-row">
      {/* ---------------------------- Barra lateral ---------------------------- */}
      <nav className="no-imprimir flex shrink-0 items-center gap-1 overflow-x-auto border-t border-black/20 bg-cafe-800 px-2 py-1.5 md:w-[104px] md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-t-0 md:px-2 md:py-3.5">
        <button
          onClick={() => ir('inicio')}
          aria-label="Inicio"
          className="mb-0 hidden shrink-0 md:mb-3 md:block"
        >
          <Emblema tamano={72} />
        </button>

        {SECCIONES.map((s) => {
          const activa = s.id === vista && !enComanda
          return (
            <button
              key={s.id}
              onClick={() => ir(s.id)}
              className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-colors md:w-full md:py-2.5 ${
                activa
                  ? 'bg-[#4A3018] text-marfil'
                  : 'text-[#B79A78] hover:bg-white/5 hover:text-marfil'
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={s.icono} />
              </svg>
              <span className="text-[11.5px] font-bold tracking-wide">{s.nombre}</span>
            </button>
          )
        })}

        <div className="hidden flex-1 md:block" />
        <div className="hidden text-center text-[10px] leading-relaxed font-bold tracking-widest text-[#8C7256] md:block">
          REINA
          <br />
          TPV
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ------------------------------ Cabecera ------------------------------ */}
        <header className="no-imprimir flex shrink-0 items-center gap-4 border-b border-borde bg-white px-4 py-2.5 md:h-[70px] md:px-6 md:py-0">
          <button onClick={() => ir('inicio')} className="shrink-0 md:hidden" aria-label="Inicio">
            <Emblema tamano={40} />
          </button>

          {enComanda && (
            <button
              onClick={() => setTicketId(null)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-borde-fuerte bg-lino px-3.5 text-sm font-bold text-cafe-600 hover:bg-cafe-100"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Mesas
            </button>
          )}

          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate font-serif text-xl font-semibold tracking-tight md:text-[25px]">
              {titulo}
            </h1>
            <span className="hidden truncate text-[13.5px] font-semibold text-cafe-500 lg:block">
              {subtitulo}
            </span>
          </div>

          <div className="flex-1" />

          {abiertos.length > 0 && (
            <button
              onClick={() => ir('mesas')}
              className="flex h-11 shrink-0 items-center gap-2.5 rounded-xl border border-[#F0DCA6] bg-[#FFF8E6] px-3 md:px-4"
            >
              <span className="latido h-2 w-2 rounded-full bg-[#E0A21C]" />
              <span className="hidden text-[11px] font-extrabold tracking-widest text-[#A97B12] sm:block">
                SIN COBRAR
              </span>
              <span className="text-lg font-extrabold tabular-nums">
                {formatearEuros(totalAbierto)}
              </span>
            </button>
          )}

          <div className="hidden shrink-0 text-right leading-tight sm:block">
            <div className="text-lg font-extrabold tabular-nums">{hora}</div>
            <div className="text-[11.5px] font-semibold text-cafe-500 first-letter:uppercase">
              {fecha}
            </div>
          </div>
        </header>

        {/* -------------------------------- Vista -------------------------------- */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto h-full max-w-[1700px] p-4 md:p-6">
            {enComanda ? (
              <Comanda ticketId={ticketId} onSalir={() => setTicketId(null)} />
            ) : (
              <>
                {vista === 'inicio' && <Inicio onIr={ir} />}
                {vista === 'mesas' && <Mesas onAbrirComanda={setTicketId} />}
                {vista === 'caja' && <Caja />}
                {vista === 'tickets' && <Tickets />}
                {vista === 'clientes' && (
                  <Clientes
                    onFacturar={(id) => {
                      setClienteAFacturar(id)
                      setVista('facturas')
                    }}
                  />
                )}
                {vista === 'facturas' && (
                  <Facturas
                    clienteInicial={clienteAFacturar}
                    onConsumido={() => setClienteAFacturar(null)}
                  />
                )}
                {vista === 'informes' && <Informes />}
                {vista === 'ajustes' && <Ajustes />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
