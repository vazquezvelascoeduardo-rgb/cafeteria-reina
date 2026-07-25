import { useEffect, type ReactNode } from 'react'

type Tono = 'principal' | 'suave' | 'exito' | 'peligro' | 'neutro'

const TONOS: Record<Tono, string> = {
  principal: 'bg-cafe-800 text-marfil hover:bg-cafe-700 active:bg-cafe-900 shadow-sm',
  suave: 'bg-cafe-100 text-cafe-600 hover:bg-cafe-200 active:bg-cafe-300',
  exito: 'bg-cobro text-white hover:bg-cobro-oscuro shadow-[0_8px_18px_rgba(31,122,77,.28)]',
  peligro: 'bg-anular text-white hover:brightness-110 shadow-sm',
  neutro: 'bg-lino text-cafe-600 border border-borde-fuerte hover:bg-cafe-100',
}

export function Boton({
  children,
  tono = 'neutro',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tono?: Tono }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-3 text-sm font-bold transition-all select-none active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${TONOS[tono]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-borde bg-white p-5 ${className}`}>{children}</div>
  )
}

/** Rótulo dorado en mayúsculas espaciadas, con una línea que llega hasta el final */
export function Rotulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="rotulo">{children}</span>
      <span className="h-px flex-1 bg-cafe-200" />
      {extra && <span className="text-xs font-bold text-cafe-500">{extra}</span>}
    </div>
  )
}

/** Fila de botones y filtros de una pantalla. El título vive en la cabecera */
export function BarraAcciones({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`mb-5 flex flex-wrap items-center gap-3 ${className}`}>{children}</div>
}

export function Campo({
  etiqueta,
  ayuda,
  children,
  className = '',
}: {
  etiqueta: string
  ayuda?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold tracking-wide text-cafe-500 uppercase">
        {etiqueta}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-cafe-500">{ayuda}</span>}
    </label>
  )
}

export const claseInput =
  'w-full rounded-xl border border-borde-fuerte bg-white px-3.5 py-2.5 text-base font-semibold text-cafe-900 outline-none placeholder:font-normal placeholder:text-cafe-400 focus:border-oro focus:ring-2 focus:ring-oro/20'

export function Entrada(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseInput} ${props.className ?? ''}`} />
}

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-cafe-900/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        className={`animar-entrada max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-3xl bg-lino-200 p-5 shadow-2xl sm:rounded-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-semibold text-cafe-900">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-cafe-500 hover:bg-cafe-200 hover:text-cafe-900"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Confirmación para las cosas que no tienen vuelta atrás.
 *
 * En vez del cuadro del navegador, que se acepta sin leerlo, esta enseña
 * exactamente qué se va a perder y obliga a apuntar al botón rojo.
 */
export function Confirmar({
  abierto,
  titulo,
  aviso,
  detalle,
  textoBoton,
  onConfirmar,
  onCerrar,
}: {
  abierto: boolean
  titulo: string
  aviso: ReactNode
  detalle?: ReactNode
  textoBoton: string
  onConfirmar: () => void
  onCerrar: () => void
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <div className="mb-4 rounded-2xl border border-[#F0D3CC] bg-[#FFF7F5] px-5 py-4 text-anular">
        {aviso}
      </div>

      {detalle && (
        <div className="mb-4 rounded-xl border border-borde bg-white px-4 py-3 text-sm">
          {detalle}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton tono="neutro" onClick={onCerrar} className="flex-1 !py-4 !text-base">
          No, dejarlo como está
        </Boton>
        <Boton tono="peligro" onClick={onConfirmar} className="flex-1 !py-4 !text-base">
          {textoBoton}
        </Boton>
      </div>
    </Modal>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-cafe-300 bg-white/60 px-6 py-12 text-center leading-relaxed font-semibold text-cafe-400">
      {children}
    </div>
  )
}

export function Etiqueta({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'verde' | 'ambar' | 'azul' | 'rojo'
}) {
  const tonos = {
    neutro: 'bg-cafe-100 text-cafe-600',
    verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-[#FFF8E6] text-[#A97B12]',
    azul: 'bg-sky-100 text-sky-800',
    rojo: 'bg-[#FFF7F5] text-anular',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-extrabold ${tonos[tono]}`}>
      {children}
    </span>
  )
}

/** Importe grande en la tipografía de la marca */
export function Importe({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`font-serif font-semibold tabular-nums ${className}`} style={{ letterSpacing: '-.02em' }}>
      {children}
    </span>
  )
}
