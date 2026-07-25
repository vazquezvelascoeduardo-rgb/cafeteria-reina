/**
 * Crea un archivo ZIP con varios ficheros dentro, sin librerías.
 *
 * Los archivos se guardan sin comprimir: para unos CSV de unos pocos kilobytes
 * no compensa, y así el código es corto y verificable. Windows lo abre con
 * doble clic como cualquier carpeta comprimida.
 */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  return tabla
})()

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** La hora en el formato de dos palabras que usa el ZIP desde los tiempos del DOS */
function fechaDos(fecha: Date): { hora: number; dia: number } {
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2),
    dia: ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  }
}

export type ArchivoZip = { nombre: string; contenido: string }

export function crearZip(archivos: ArchivoZip[], fecha = new Date()): Blob {
  const codificador = new TextEncoder()
  const { hora, dia } = fechaDos(fecha)

  const locales: Uint8Array[] = []
  const central: Uint8Array[] = []
  let desplazamiento = 0

  for (const archivo of archivos) {
    const nombre = codificador.encode(archivo.nombre)
    const datos = codificador.encode(archivo.contenido)
    const crc = crc32(datos)

    // Cabecera que precede a cada archivo
    const cabecera = new DataView(new ArrayBuffer(30))
    cabecera.setUint32(0, 0x04034b50, true) // firma
    cabecera.setUint16(4, 20, true) // versión necesaria
    cabecera.setUint16(6, 0x0800, true) // los nombres van en UTF-8
    cabecera.setUint16(8, 0, true) // sin compresión
    cabecera.setUint16(10, hora, true)
    cabecera.setUint16(12, dia, true)
    cabecera.setUint32(14, crc, true)
    cabecera.setUint32(18, datos.length, true)
    cabecera.setUint32(22, datos.length, true)
    cabecera.setUint16(26, nombre.length, true)
    cabecera.setUint16(28, 0, true) // sin campos extra

    locales.push(new Uint8Array(cabecera.buffer), nombre, datos)

    // Entrada equivalente en el índice del final
    const entrada = new DataView(new ArrayBuffer(46))
    entrada.setUint32(0, 0x02014b50, true)
    entrada.setUint16(4, 20, true) // versión con la que se creó
    entrada.setUint16(6, 20, true)
    entrada.setUint16(8, 0x0800, true)
    entrada.setUint16(10, 0, true)
    entrada.setUint16(12, hora, true)
    entrada.setUint16(14, dia, true)
    entrada.setUint32(16, crc, true)
    entrada.setUint32(20, datos.length, true)
    entrada.setUint32(24, datos.length, true)
    entrada.setUint16(28, nombre.length, true)
    entrada.setUint32(42, desplazamiento, true) // dónde empieza este archivo

    central.push(new Uint8Array(entrada.buffer), nombre)
    desplazamiento += 30 + nombre.length + datos.length
  }

  const tamanoCentral = central.reduce((s, p) => s + p.length, 0)

  const cierre = new DataView(new ArrayBuffer(22))
  cierre.setUint32(0, 0x06054b50, true)
  cierre.setUint16(8, archivos.length, true)
  cierre.setUint16(10, archivos.length, true)
  cierre.setUint32(12, tamanoCentral, true)
  cierre.setUint32(16, desplazamiento, true)

  const partes = [...locales, ...central, new Uint8Array(cierre.buffer)]
  const total = partes.reduce((s, p) => s + p.length, 0)
  const salida = new Uint8Array(total)
  let posicion = 0
  for (const parte of partes) {
    salida.set(parte, posicion)
    posicion += parte.length
  }

  return new Blob([salida], { type: 'application/zip' })
}
