/** Cajón del dinero abierto, con los billetes asomando */
export function IconoCajon({ tamano = 24 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Los billetes, saliendo por arriba */}
      <rect x="9" y="2.5" width="6" height="4" rx="0.8" />
      <path d="M12 4.5h.01" />
      {/* La bandeja de las monedas */}
      <path d="M6 10.5V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2.5" />
      {/* El cuerpo del cajón */}
      <rect x="2.5" y="10.5" width="19" height="10" rx="1.5" />
      <path d="M2.5 14.5h19" />
      {/* El tirador */}
      <path d="M10 17.5h4" />
    </svg>
  )
}
