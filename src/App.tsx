import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { copiaAutomaticaSiToca } from './lib/copiaAutomatica'
import { Mesas } from './pages/Mesas'
import { Comanda } from './pages/Comanda'
import { Caja } from './pages/Caja'
import { Clientes } from './pages/Clientes'
import { Facturas } from './pages/Facturas'
import { Informes } from './pages/Informes'
import { Ajustes } from './pages/Ajustes'
import { formatearEuros } from './lib/dinero'

type Vista = 'mesas' | 'caja' | 'clientes' | 'facturas' | 'informes' | 'ajustes'

const PESTANAS: { id: Vista; nombre: string; icono: string }[] = [
  { id: 'mesas', nombre: 'Mesas', icono: '🍽️' },
  { id: 'caja', nombre: 'Caja', icono: '💶' },
  { id: 'clientes', nombre: 'Clientes', icono: '👤' },
  { id: 'facturas', nombre: 'Facturas', icono: '🧾' },
  { id: 'informes', nombre: 'Informes', icono: '📊' },
  { id: 'ajustes', nombre: 'Ajustes', icono: '⚙️' },
]

export default function App() {
  const [vista, setVista] = useState<Vista>('mesas')
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [clienteAFacturar, setClienteAFacturar] = useState<number | null>(null)

  const abiertos = useLiveQuery(() => db.tickets.where('estado').equals('abierto').toArray(), [], [])
  const totalAbierto = abiertos.reduce((s, t) => s + t.total, 0)

  // Copia del día a la carpeta elegida, en cuanto se abre la aplicación
  useEffect(() => {
    copiaAutomaticaSiToca()
  }, [])

  const ir = (destino: Vista) => {
    setTicketId(null)
    setVista(destino)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="no-imprimir shrink-0 border-b border-cafe-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2">
          <span className="mr-2 hidden text-lg font-bold text-cafe-800 sm:block">Cafetería</span>

          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                onClick={() => ir(p.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                  vista === p.id && ticketId === null
                    ? 'bg-cafe-600 text-white'
                    : 'text-cafe-600 hover:bg-cafe-100'
                }`}
              >
                <span aria-hidden>{p.icono}</span>
                <span className="hidden md:inline">{p.nombre}</span>
              </button>
            ))}
          </nav>

          {abiertos.length > 0 && (
            <button
              onClick={() => ir('mesas')}
              className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-right hover:bg-amber-200"
            >
              <span className="block text-[10px] leading-none font-bold tracking-wide text-amber-700 uppercase">
                Sin cobrar
              </span>
              <span className="block text-base leading-tight font-bold tabular-nums text-amber-900">
                {formatearEuros(totalAbierto)}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto h-full max-w-[1600px] p-4 sm:p-6">
          {ticketId !== null ? (
            <Comanda ticketId={ticketId} onSalir={() => setTicketId(null)} />
          ) : (
            <>
              {vista === 'mesas' && <Mesas onAbrirComanda={setTicketId} />}
              {vista === 'caja' && <Caja />}
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
  )
}
