import { useId } from 'react'

/**
 * Logo de la Cafetería Reina redibujado en vector: la corona, el aro de puntos
 * y la firma. Al ser formas y no una imagen, se ve nítido a cualquier tamaño.
 */
export function Logo({
  tamano = 160,
  variante = 'corona',
  tono = 'oscuro',
  className = '',
}: {
  tamano?: number
  variante?: 'corona' | 'completo'
  tono?: 'oscuro' | 'claro'
  className?: string
}) {
  // Cada logo necesita su propio id de degradado o se pisan entre ellos
  const id = useId().replace(/:/g, '')

  const completo = variante === 'completo'
  const tinta = tono === 'claro' ? '#FFF8E6' : '#17120E'
  const aro = tono === 'claro' ? 'rgba(226,199,132,.95)' : '#D9BE7E'
  const emblema = completo ? tamano * 0.31 : tamano

  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      style={{ gap: completo ? tamano * 0.045 : 0 }}
    >
      <span
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: emblema, height: emblema }}
      >
        {/* Aro discontinuo con las motas de alrededor */}
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full overflow-visible">
          <circle
            cx="60"
            cy="60"
            r="55"
            fill="none"
            stroke={aro}
            strokeWidth="1.8"
            strokeDasharray="252 94"
            strokeLinecap="round"
            transform="rotate(128 60 60)"
          />
          <circle
            cx="60"
            cy="60"
            r="47"
            fill="none"
            stroke={aro}
            strokeWidth="0.9"
            strokeDasharray="1 9"
            strokeLinecap="round"
            opacity="0.85"
          />
          <circle cx="16" cy="28" r="2.1" fill={aro} />
          <circle cx="8" cy="46" r="1.4" fill={aro} />
          <circle cx="27" cy="15" r="1.6" fill={aro} />
          <circle cx="103" cy="34" r="1.5" fill={aro} />
        </svg>

        {/* La corona */}
        <svg
          viewBox="-4 -18 108 102"
          className="relative overflow-visible"
          style={{ width: emblema * 0.62 }}
        >
          <defs>
            <linearGradient id={`oro-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F4E2AE" />
              <stop offset="0.45" stopColor="#C9A227" />
              <stop offset="1" stopColor="#96700F" />
            </linearGradient>
          </defs>
          <g fill={`url(#oro-${id})`}>
            <path d="M10 24 L22 60 H78 L90 24 L72 41 L50 13 L28 41 Z" />
            <circle cx="10" cy="20" r="4.6" />
            <circle cx="90" cy="20" r="4.6" />
            <circle cx="50" cy="9" r="4.2" />
            <rect x="47.2" y="-16" width="5.6" height="18" rx="2.4" />
            <rect x="41.5" y="-10.5" width="17" height="5.2" rx="2.4" />
            <rect x="12" y="64" width="76" height="14" rx="4.5" />
          </g>
          <g fill="#FFF8E6" opacity="0.9">
            <circle cx="30" cy="71" r="2.5" />
            <circle cx="50" cy="71" r="2.5" />
            <circle cx="70" cy="71" r="2.5" />
          </g>
          <path d="M22 60 H78" stroke="#8A6410" strokeWidth="1" opacity="0.35" />
        </svg>
      </span>

      {completo && (
        <span className="flex flex-col items-start" style={{ gap: tamano * 0.012 }}>
          <span
            className="font-firma"
            style={{ fontSize: tamano * 0.36, lineHeight: 0.95, color: tinta, letterSpacing: '-.01em' }}
          >
            Reina
          </span>
          <span
            className="font-extrabold whitespace-nowrap"
            style={{ fontSize: tamano * 0.058, letterSpacing: tamano * 0.0105, color: tinta }}
          >
            CAFETERÍA &amp; PANADERÍA
          </span>
        </span>
      )}
    </span>
  )
}

/** La corona dentro del azulejo marfil con reborde dorado: el icono de la app */
export function Emblema({ tamano = 72, className = '' }: { tamano?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: tamano,
        height: tamano,
        borderRadius: Math.round(tamano * 0.24),
        background: 'linear-gradient(160deg,#FFFDF8,#F3E8D6)',
        border: '1px solid #E6D8C0',
        boxShadow: '0 6px 14px rgba(51,32,15,.22)',
      }}
    >
      <Logo tamano={Math.round(tamano * 0.66)} />
    </span>
  )
}
