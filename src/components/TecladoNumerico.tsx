/**
 * Teclado en pantalla para escribir importes sin usar el teclado físico.
 * Trabaja sobre un texto tipo "12,50" que el que lo usa convierte a céntimos.
 */
export function TecladoNumerico({
  valor,
  onCambio,
  className = '',
}: {
  valor: string
  onCambio: (nuevo: string) => void
  className?: string
}) {
  const pulsar = (tecla: string) => {
    if (tecla === 'borrar') {
      onCambio(valor.slice(0, -1))
      return
    }
    if (tecla === 'limpiar') {
      onCambio('')
      return
    }
    if (tecla === ',') {
      if (valor.includes(',')) return
      onCambio(valor === '' ? '0,' : valor + ',')
      return
    }
    // Máximo dos decimales
    const [, decimales] = valor.split(',')
    if (decimales !== undefined && decimales.length >= 2) return
    if (valor === '0') {
      onCambio(tecla)
      return
    }
    onCambio(valor + tecla)
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'borrar']

  return (
    <div className={`grid auto-rows-fr grid-cols-3 gap-2 ${className}`}>
      {teclas.map((t) => (
        <button
          key={t}
          onClick={() => pulsar(t)}
          className="min-h-14 rounded-xl border border-borde bg-white text-xl font-extrabold text-cafe-900 transition-all hover:bg-cafe-100 active:scale-[.96]"
        >
          {t === 'borrar' ? '⌫' : t}
        </button>
      ))}
    </div>
  )
}
