/**
 * Genera los iconos PNG de la app dibujando una taza de café a mano.
 * Sin dependencias: escribe el PNG byte a byte.
 *
 *   node scripts/generar-iconos.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const FONDO = [124, 74, 45] // #7c4a2d
const TINTA = [255, 255, 255]

/** ¿Está el punto (u,v), en coordenadas 0..1, dentro del dibujo de la taza? */
function esTinta(u, v) {
  // Cuerpo de la taza (trapecio ligeramente estrechado hacia abajo)
  const arriba = 0.4
  const abajo = 0.7
  if (v >= arriba && v <= abajo) {
    const t = (v - arriba) / (abajo - arriba)
    const izq = 0.27 + t * 0.05
    const der = 0.63 - t * 0.05
    if (u >= izq && u <= der) return true
  }

  // Asa: media corona a la derecha del cuerpo
  const dx = u - 0.66
  const dy = v - 0.5
  const r = Math.hypot(dx, dy)
  if (u > 0.6 && r <= 0.115 && r >= 0.07) return true

  // Platillo
  const px = (u - 0.45) / 0.32
  const py = (v - 0.765) / 0.042
  if (px * px + py * py <= 1) return true

  // Vapor: dos trazos ondulados sobre la taza
  if (v >= 0.14 && v <= 0.34) {
    const onda = 0.028 * Math.sin((v - 0.14) * 34)
    for (const centro of [0.38, 0.52]) {
      if (Math.abs(u - (centro + onda)) <= 0.019) return true
    }
  }

  return false
}

function dibujar(tamano) {
  const pixeles = Buffer.alloc(tamano * tamano * 4)
  const MUESTRAS = 3 // suavizado de bordes por supermuestreo

  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      let dentro = 0
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const u = (x + (sx + 0.5) / MUESTRAS) / tamano
          const v = (y + (sy + 0.5) / MUESTRAS) / tamano
          if (esTinta(u, v)) dentro++
        }
      }
      const mezcla = dentro / (MUESTRAS * MUESTRAS)
      const i = (y * tamano + x) * 4
      for (let c = 0; c < 3; c++) {
        pixeles[i + c] = Math.round(FONDO[c] + (TINTA[c] - FONDO[c]) * mezcla)
      }
      pixeles[i + 3] = 255
    }
  }
  return pixeles
}

// --- Codificación PNG -------------------------------------------------------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, datos) {
  const longitud = Buffer.alloc(4)
  longitud.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([longitud, cuerpo, crc])
}

function comoPng(pixeles, tamano) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tamano, 0)
  ihdr.writeUInt32BE(tamano, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Cada fila lleva delante un byte de filtro (0 = sin filtro)
  const filas = Buffer.alloc(tamano * (tamano * 4 + 1))
  for (let y = 0; y < tamano; y++) {
    const origen = y * tamano * 4
    const destino = y * (tamano * 4 + 1)
    filas[destino] = 0
    pixeles.copy(filas, destino + 1, origen, origen + tamano * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(join(RAIZ, 'public'), { recursive: true })

for (const [nombre, tamano] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const ruta = join(RAIZ, 'public', nombre)
  writeFileSync(ruta, comoPng(dibujar(tamano), tamano))
  console.log(`Creado public/${nombre} (${tamano}×${tamano})`)
}
