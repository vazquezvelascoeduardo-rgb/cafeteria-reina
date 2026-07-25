import { db } from '../db'
import { exportarCopia } from './acciones'
import { generarHojas } from './exportar'
import { aDiaLocal } from './fechas'

/**
 * Copia automática de los datos a una o varias carpetas del ordenador.
 *
 * La gracia está en elegir carpetas que ya se sincronizan solas con la nube:
 * la de OneDrive (que Windows trae puesta) o la de Google Drive para escritorio.
 * Se puede tener más de una a la vez, y así la copia queda en dos sitios
 * distintos sin depender de ningún servidor propio.
 *
 * Usa la File System Access API, que funciona en Chrome y Edge de escritorio.
 */

const CLAVE_CARPETAS = 'carpetasCopia'
const CLAVE_ULTIMA = 'ultimaCopia'

// El navegador todavía no tiene estos métodos en los tipos estándar
type HandleConPermisos = FileSystemDirectoryHandle & {
  queryPermission(opciones: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(opciones: { mode: 'readwrite' }): Promise<PermissionState>
}

declare global {
  interface Window {
    showDirectoryPicker?: (opciones?: {
      mode?: 'read' | 'readwrite'
      startIn?: string
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export type CarpetaCopia = {
  nombre: string
  /** Si el navegador ha olvidado el permiso, hay que volver a concederlo con un clic */
  permisoConcedido: boolean
}

/** ¿Puede este navegador guardar en una carpeta? (Chrome y Edge sí, Firefox y Safari no) */
export function hayApiDeCarpetas(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

async function leerHandles(): Promise<HandleConPermisos[]> {
  const fila = await db.config.get(CLAVE_CARPETAS)
  const valor = fila?.valor
  return Array.isArray(valor) ? (valor as HandleConPermisos[]) : []
}

async function guardarHandles(handles: HandleConPermisos[]) {
  await db.config.put({ clave: CLAVE_CARPETAS, valor: handles })
}

/** El permiso de una carpeta puede caducar al cerrar el navegador */
async function tienePermiso(handle: HandleConPermisos): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') return true
  try {
    return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

export async function listarCarpetas(): Promise<CarpetaCopia[]> {
  const handles = await leerHandles()
  return Promise.all(
    handles.map(async (h) => ({ nombre: h.name, permisoConcedido: await tienePermiso(h) })),
  )
}

export async function ultimaCopia(): Promise<string | null> {
  const fila = await db.config.get(CLAVE_ULTIMA)
  return (fila?.valor as string | undefined) ?? null
}

/** Pregunta en qué carpeta guardar y la añade a la lista */
export async function anadirCarpeta(): Promise<string | null> {
  if (!window.showDirectoryPicker) return null

  const nuevo = (await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents',
  })) as HandleConPermisos

  const handles = await leerHandles()
  for (const existente of handles) {
    if (await existente.isSameEntry(nuevo)) return existente.name // ya estaba
  }

  await guardarHandles([...handles, nuevo])
  return nuevo.name
}

export async function quitarCarpeta(indice: number) {
  const handles = await leerHandles()
  await guardarHandles(handles.filter((_, i) => i !== indice))
}

async function escribir(carpeta: FileSystemDirectoryHandle, nombre: string, contenido: string) {
  const archivo = await carpeta.getFileHandle(nombre, { create: true })
  const escritura = await archivo.createWritable()
  await escritura.write(contenido)
  await escritura.close()
}

/** Los archivos que se dejan en cada carpeta de copia */
async function archivosDeLaCopia(): Promise<{ nombre: string; contenido: string }[]> {
  const copia = await exportarCopia()
  const hojas = await generarHojas()
  return [
    { nombre: `copia-cafeteria-${aDiaLocal()}.json`, contenido: JSON.stringify(copia, null, 2) },
    ...hojas,
  ]
}

export type ResultadoCopia = {
  guardadas: string[]
  fallidas: { carpeta: string; motivo: string }[]
  archivos: number
}

/**
 * Escribe la copia en todas las carpetas configuradas.
 * `pedirPermiso` solo puede ser true si viene de un clic del usuario.
 */
export async function copiarAhora(pedirPermiso = true): Promise<ResultadoCopia> {
  const handles = await leerHandles()
  if (handles.length === 0) throw new Error('Todavía no has elegido ninguna carpeta para las copias')

  const archivos = await archivosDeLaCopia()
  const guardadas: string[] = []
  const fallidas: { carpeta: string; motivo: string }[] = []

  for (const handle of handles) {
    try {
      if (!(await tienePermiso(handle))) {
        if (!pedirPermiso) {
          fallidas.push({ carpeta: handle.name, motivo: 'hace falta volver a dar permiso' })
          continue
        }
        if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          fallidas.push({ carpeta: handle.name, motivo: 'no se ha dado permiso' })
          continue
        }
      }
      for (const archivo of archivos) {
        await escribir(handle, archivo.nombre, archivo.contenido)
      }
      guardadas.push(handle.name)
    } catch (e) {
      fallidas.push({
        carpeta: handle.name,
        motivo: e instanceof Error ? e.message : 'error desconocido',
      })
    }
  }

  // Solo se da el día por copiado si al menos una carpeta ha recibido los datos
  if (guardadas.length > 0) {
    await db.config.put({ clave: CLAVE_ULTIMA, valor: aDiaLocal() })
  }

  return { guardadas, fallidas, archivos: archivos.length }
}

/**
 * Se llama al abrir la app: si hay carpetas y hoy todavía no se ha copiado,
 * hace la copia sin molestar a nadie.
 *
 * Nunca pide permisos aquí: pedirlos requiere que el usuario acabe de hacer
 * clic en algo. Si el permiso caducó, se avisa desde Inicio y desde Ajustes.
 */
export async function copiaAutomaticaSiToca(): Promise<boolean> {
  try {
    const handles = await leerHandles()
    if (handles.length === 0) return false
    if ((await ultimaCopia()) === aDiaLocal()) return false

    const resultado = await copiarAhora(false)
    return resultado.guardadas.length > 0
  } catch {
    // Una copia que falla nunca debe impedir que se abra la caja
    return false
  }
}
