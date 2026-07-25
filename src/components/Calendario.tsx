import { formatearEuros } from '../lib/dinero'
import { aDiaLocal, mesAnterior, mesSiguiente, nombreMes, rejillaDelMes } from '../lib/fechas'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Calendario de un mes con lo facturado cada día.
 * Al tocar un día se abre el detalle de ese día.
 */
export function Calendario({
  mes,
  onCambiarMes,
  importesPorDia,
  diaSeleccionado,
  onSeleccionarDia,
}: {
  mes: string
  onCambiarMes: (mes: string) => void
  importesPorDia: Map<string, number>
  diaSeleccionado: string | null
  onSeleccionarDia: (dia: string) => void
}) {
  const casillas = rejillaDelMes(mes)
  const hoy = aDiaLocal()

  const delMes = casillas.filter((d): d is string => d !== null)
  const totalMes = delMes.reduce((s, d) => s + (importesPorDia.get(d) ?? 0), 0)
  const maximo = Math.max(1, ...delMes.map((d) => importesPorDia.get(d) ?? 0))
  const diasConVentas = delMes.filter((d) => (importesPorDia.get(d) ?? 0) > 0).length

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => onCambiarMes(mesAnterior(mes))}
          aria-label="Mes anterior"
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-bold text-cafe-700 shadow-sm hover:bg-cafe-100"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-lg font-bold text-cafe-900 capitalize">{nombreMes(mes)}</div>
          <div className="text-sm text-cafe-500">
            {formatearEuros(totalMes)} en {diasConVentas}{' '}
            {diasConVentas === 1 ? 'día' : 'días'}
          </div>
        </div>
        <button
          onClick={() => onCambiarMes(mesSiguiente(mes))}
          aria-label="Mes siguiente"
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-bold text-cafe-700 shadow-sm hover:bg-cafe-100"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-cafe-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {casillas.map((dia, i) => {
          if (dia === null) return <div key={i} />

          const importe = importesPorDia.get(dia) ?? 0
          const esHoy = dia === hoy
          const elegido = dia === diaSeleccionado
          const numero = Number(dia.slice(-2))
          // Cuanto más se facturó ese día, más intenso el fondo
          const intensidad = importe === 0 ? 0 : 0.15 + (importe / maximo) * 0.85

          return (
            <button
              key={dia}
              onClick={() => onSeleccionarDia(dia)}
              className={`relative flex h-16 flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95 sm:h-20 ${
                elegido
                  ? 'border-cafe-600 ring-2 ring-cafe-600/25'
                  : esHoy
                    ? 'border-amber-400'
                    : 'border-transparent hover:border-cafe-300'
              } ${importe === 0 ? 'bg-cafe-100/60' : ''}`}
              style={
                importe > 0
                  ? { backgroundColor: `color-mix(in srgb, var(--color-cafe-500) ${intensidad * 100}%, white)` }
                  : undefined
              }
            >
              <span
                className={`text-sm leading-none font-bold ${
                  intensidad > 0.55 ? 'text-white' : 'text-cafe-800'
                }`}
              >
                {numero}
              </span>
              {importe > 0 && (
                <span
                  className={`mt-1 text-[11px] leading-none font-semibold tabular-nums sm:text-xs ${
                    intensidad > 0.55 ? 'text-white' : 'text-cafe-700'
                  }`}
                >
                  {formatearEuros(importe)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
