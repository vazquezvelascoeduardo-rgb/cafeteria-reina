import { db } from '../db'

/**
 * Apertura del cajón portamonedas.
 *
 * El cajón no se conecta al ordenador: se enchufa a la impresora de tickets con
 * un cable de teléfono (RJ11). Para abrirlo hay que mandarle a la impresora un
 * comando corto —el "pulso"— y es la impresora la que suelta el cierre.
 *
 * Ese comando se manda por el puerto serie de la impresora usando la Web Serial
 * del navegador, que pide permiso una vez y luego lo recuerda. Funciona en
 * Chrome y Edge de escritorio.
 */

// ESC p 0 25 250 — el comando de toda la vida para dar el pulso al cajón
const PULSO = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])

const CLAVE_PUERTO = 'puertoCajon'

type InfoPuerto = { usbVendorId?: number; usbProductId?: number }

type PuertoSerie = {
  open(opciones: { baudRate: number }): Promise<void>
  close(): Promise<void>
  getInfo(): InfoPuerto
  readable: unknown
  writable: WritableStream<Uint8Array> | null
}

type ApiSerie = {
  requestPort(): Promise<PuertoSerie>
  getPorts(): Promise<PuertoSerie[]>
}

function api(): ApiSerie | null {
  const serie = (navigator as Navigator & { serial?: ApiSerie }).serial
  return serie ?? null
}

/** ¿Puede este navegador hablar con el puerto de la impresora? */
export function haySoporteCajon(): boolean {
  return api() !== null
}

async function infoGuardada(): Promise<InfoPuerto | null> {
  const fila = await db.config.get(CLAVE_PUERTO)
  return (fila?.valor as InfoPuerto | undefined) ?? null
}

function mismaImpresora(a: InfoPuerto, b: InfoPuerto): boolean {
  return a.usbVendorId === b.usbVendorId && a.usbProductId === b.usbProductId
}

/** Busca entre los puertos ya autorizados el que se eligió en su día */
async function buscarPuerto(): Promise<PuertoSerie | null> {
  const serie = api()
  if (!serie) return null

  const guardada = await infoGuardada()
  if (!guardada) return null

  const puertos = await serie.getPorts()
  return puertos.find((p) => mismaImpresora(p.getInfo(), guardada)) ?? puertos[0] ?? null
}

export async function estadoCajon(): Promise<{ configurado: boolean; disponible: boolean }> {
  const guardada = await infoGuardada()
  return { configurado: guardada !== null, disponible: (await buscarPuerto()) !== null }
}

/**
 * Pide elegir el puerto de la impresora. Tiene que salir de un clic: el
 * navegador no deja abrir este diálogo por su cuenta.
 */
export async function conectarCajon(): Promise<boolean> {
  const serie = api()
  if (!serie) return false

  const puerto = await serie.requestPort()
  await db.config.put({ clave: CLAVE_PUERTO, valor: puerto.getInfo() })
  return true
}

export async function olvidarCajon() {
  await db.config.delete(CLAVE_PUERTO)
}

export class CajonNoConfigurado extends Error {}

/** Manda el pulso. Devuelve cuando el cajón ya ha recibido el comando */
export async function abrirCajon(baudios = 9600): Promise<void> {
  const puerto = await buscarPuerto()
  if (!puerto) {
    throw new CajonNoConfigurado('Todavía no has elegido a qué impresora está enchufado el cajón')
  }

  let abierto = false
  try {
    await puerto.open({ baudRate: baudios })
    abierto = true

    if (!puerto.writable) throw new Error('El puerto no deja escribir')
    const escritor = puerto.writable.getWriter()
    await escritor.write(PULSO)
    escritor.releaseLock()
  } catch (e) {
    // El caso típico: Windows tiene el puerto cogido por el controlador de la impresora
    const motivo = e instanceof Error ? e.message : 'error desconocido'
    throw new Error(
      `No se ha podido abrir el cajón (${motivo}). Comprueba que la impresora está encendida y que no la esté usando otro programa.`,
    )
  } finally {
    if (abierto) {
      try {
        await puerto.close()
      } catch {
        // Si no cierra, tampoco pasa nada: se cierra al recargar
      }
    }
  }
}
