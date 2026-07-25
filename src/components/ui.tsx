import { useEffect, type ReactNode } from 'react'

type Tono = 'principal' | 'suave' | 'exito' | 'peligro' | 'neutro'

const TONOS: Record<Tono, string> = {
  principal: 'bg-cafe-600 text-white hover:bg-cafe-700 active:bg-cafe-800 shadow-sm',
  suave: 'bg-cafe-100 text-cafe-800 hover:bg-cafe-200 active:bg-cafe-300',
  exito: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm',
  peligro: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  neutro: 'bg-white text-cafe-800 border border-cafe-200 hover:bg-cafe-50 active:bg-cafe-100',
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
      className={`rounded-xl px-4 py-3 text-base font-semibold transition-colors select-none disabled:cursor-not-allowed disabled:opacity-40 ${TONOS[tono]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-cafe-200/70 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Titulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-cafe-900">{children}</h1>
      {extra}
    </div>
  )
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
      <span className="mb-1 block text-sm font-semibold text-cafe-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-cafe-500">{ayuda}</span>}
    </label>
  )
}

export const claseInput =
  'w-full rounded-xl border border-cafe-200 bg-white px-3 py-2.5 text-base text-cafe-900 outline-none placeholder:text-cafe-300 focus:border-cafe-500 focus:ring-2 focus:ring-cafe-500/20'

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-cafe-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        className={`max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-3xl bg-cafe-50 p-5 shadow-2xl sm:rounded-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-cafe-900">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-cafe-500 hover:bg-cafe-200 hover:text-cafe-800"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-cafe-300 bg-white/50 px-6 py-12 text-center text-cafe-500">
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
    neutro: 'bg-cafe-100 text-cafe-700',
    verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-amber-100 text-amber-800',
    azul: 'bg-sky-100 text-sky-800',
    rojo: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${tonos[tono]}`}>
      {children}
    </span>
  )
}
