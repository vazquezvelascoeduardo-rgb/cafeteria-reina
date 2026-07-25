import { db } from '../db'
import { exportarCopia } from './acciones'
import { generarHojas } from './exportar'
import { aDiaLocal } from './fechas'

/**
 * Copia automática de los datos a una carpeta del ordenador.
 *
 * Si esa carpeta está dentro de OneDrive (o Google Drive, o Dropbox), el propio
 * Windows se encarga de subirla a la nube. Así los datos dejan de vivir solo
 * dentro del navegador sin necesidad de montar ningún servidor.
 *
 * Usa la File System Access API, que funciona en Chrome y Edge de escritorio.
 */

const CLAVE_CARPETA = 'carpetaCopias'
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

/** ¿Puede este navegador guardar en una carpeta? (Chrome y Edge sí, Firefox y Safari no) */
export function hayApiDeCarpetas(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

async function leerHandle(): Promise<HandleConPermisos | null> {
  const fila = await db.config.get(CLAVE_CARPETA)
  return (fila?.valor as HandleConPermisos | undefined) ?? null
}

export async function estadoCopia(): Promise<{
  carpeta: string | null
  ultimaCopia: string | null
}> {
  const handle = await leerHandle()
  const ultima = await db.config.get(CLAVE_ULTIMA)
  return {
    carpeta: handle?.name ?? null,
    ultimaCopia: (ultima?.valor as string | undefined) ?? null,
  }
}

/** Pregunta al usuario en qué carpeta quiere las copias y la recuerda */
export async function elegirCarpeta(): Promise<string | null> {
  if (!window.showDirectoryPicker) return null

  const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' })
  await db.config.put({ clave: CLAVE_CARPETA, valor: handle })
  return handle.name
}

export async function olvidarCarpeta() {
  await db.config.delete(CLAVE_CARPETA)
  await db.config.delete(CLAVE_ULTIMA)
}

/** El permiso de una carpeta puede caducar al cerrar el navegador */
async function tienePermiso(handle: HandleConPermisos): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') return true
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
}

async function escribir(carpeta: FileSystemDirectoryHandle, nombre: string, contenido: string) {
  const archivo = await carpeta.getFileHandle(nombre, { create: true })
  const escritura = await archivo.createWritable()
  await escritura.write(contenido)
  await escritura.close()
}

/**
 * Escribe en la carpeta la copia completa en JSON (la que sirve para restaurar)
 * y las hojas de Excel (las que sirven para mirar los números).
 */
export async function copiarAhora(): Promise<{ carpeta: string; archivos: number }> {
  const handle = await leerHandle()
  if (!handle) throw new Error('Todavía no has elegido ninguna carpeta para las copias')

  if (!(await tienePermiso(handle))) {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new Error('No has dado permiso para escribir en esa carpeta')
    }
  }

  const hoy = aDiaLocal()
  const copia = await exportarCopia()
  await escribir(handle, `copia-cafeteria-${hoy}.json`, JSON.stringify(copia, null, 2))

  const hojas = await generarHojas()
  for (const hoja of hojas) {
    await escribir(handle, hoja.nombre, hoja.contenido)
  }

  await db.config.put({ clave: CLAVE_ULTIMA, valor: hoy })
  return { carpeta: handle.name, archivos: hojas.length + 1 }
}

/**
 * Se llama al abrir la app: si hay carpeta elegida, el permiso sigue vivo y
 * hoy todavía no se ha copiado, hace la copia sin molestar a nadie.
 *
 * Si el permiso caducó no se pide aquí: pedirlo requiere que el usuario acabe
 * de hacer clic en algo, así que se avisa desde la pantalla de Ajustes.
 */
export async function copiaAutomaticaSiToca(): Promise<boolean> {
  try {
    const handle = await leerHandle()
    if (!handle) return false

    const ultima = await db.config.get(CLAVE_ULTIMA)
    if (ultima?.valor === aDiaLocal()) return false

    if (!(await tienePermiso(handle))) return false

    await copiarAhora()
    return true
  } catch {
    // Una copia que falla nunca debe impedir que se abra la caja
    return false
  }
}
