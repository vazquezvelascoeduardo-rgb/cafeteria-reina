/**
 * Pide al navegador que no borre nunca los datos de la cafetería.
 *
 * De serie, el navegador se reserva el derecho de vaciar lo que guardan las
 * páginas si le falta espacio en disco. Para una web cualquiera da igual; aquí
 * dentro están las ventas, las mesas abiertas y las facturas.
 *
 * Con el permiso de almacenamiento persistente, los datos solo se van si
 * alguien los borra a mano. Chrome lo concede sin preguntar cuando la
 * aplicación está instalada en el escritorio, que es como se usa aquí.
 */

export type EstadoAlmacenamiento = {
  /** true = el navegador se compromete a no borrarlos por su cuenta */
  protegido: boolean
  /** Espacio que ocupan los datos, en bytes */
  ocupado: number | null
  soportado: boolean
}

export async function asegurarPersistencia(): Promise<boolean> {
  if (!navigator.storage?.persist) return false

  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function estadoAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  if (!navigator.storage?.persisted) {
    return { protegido: false, ocupado: null, soportado: false }
  }

  try {
    const protegido = await navigator.storage.persisted()
    const estimacion = await navigator.storage.estimate?.()
    return { protegido, ocupado: estimacion?.usage ?? null, soportado: true }
  } catch {
    return { protegido: false, ocupado: null, soportado: false }
  }
}

/** 1234567 -> '1,2 MB' */
export function formatearEspacio(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`.replace('.', ',')
}
