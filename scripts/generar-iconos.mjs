/**
 * Genera los iconos PNG de la aplicación: la corona del logo de Reina sobre el
 * azulejo marfil. Sin dependencias: se escribe el PNG byte a byte.
 *
 *   node scripts/generar-iconos.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- Paleta del logo ---------------------------------------------------------

const ORO_ALTO = [244, 226, 174] // #F4E2AE
const ORO_MEDIO = [201, 162, 39] // #C9A227
const ORO_BAJO = [150, 112, 15] // #96700F
const GEMA = [255, 248, 230] // #FFF8E6
const FONDO_ALTO = [255, 253, 248] // #FFFDF8
const FONDO_BAJO = [243, 232, 214] // #F3E8D6
const BORDE = [201, 162, 39]

function mezclar(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/** Degradado vertical del oro, igual que el del SVG */
function colorOro(t) {
  return t < 0.45 ? mezclar(ORO_ALTO, ORO_MEDIO, t / 0.45) : mezclar(ORO_MEDIO, ORO_BAJO, (t - 0.45) / 0.55)
}

// --- Geometría de la corona (mismas medidas que el SVG) ----------------------

const CORONA = { x0: -4, y0: -18, x1: 104, y1: 84 }

const PICOS = [
  [10, 24],
  [22, 60],
  [78, 60],
  [90, 24],
  [72, 41],
  [50, 13],
  [28, 41],
]

const CIRCULOS = [
  [10, 20, 4.6],
  [90, 20, 4.6],
  [50, 9, 4.2],
]

/** [x, y, ancho, alto, radio] */
const RECTANGULOS = [
  [47.2, -16, 5.6, 18, 2.4],
  [41.5, -10.5, 17, 5.2, 2.4],
  [12, 64, 76, 14, 4.5],
]

const GEMAS = [
  [30, 71, 2.5],
  [50, 71, 2.5],
  [70, 71, 2.5],
]

function dentroDelPoligono(x, y, puntos) {
  let dentro = false
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const [xi, yi] = puntos[i]
    const [xj, yj] = puntos[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

function dentroDelRectangulo(x, y, [rx, ry, ancho, alto, radio]) {
  if (x < rx || x > rx + ancho || y < ry || y > ry + alto) return false
  // Esquinas redondeadas
  const dx = Math.max(rx + radio - x, 0, x - (rx + ancho - radio))
  const dy = Math.max(ry + radio - y, 0, y - (ry + alto - radio))
  return dx * dx + dy * dy <= radio * radio
}

/** Devuelve 'oro', 'gema' o null para un punto en coordenadas del SVG */
function queHayEn(x, y) {
  for (const [cx, cy, r] of GEMAS) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return 'gema'
  }
  if (dentroDelPoligono(x, y, PICOS)) return 'oro'
  for (const [cx, cy, r] of CIRCULOS) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return 'oro'
  }
  for (const rect of RECTANGULOS) {
    if (dentroDelRectangulo(x, y, rect)) return 'oro'
  }
  return null
}

// --- Dibujo ------------------------------------------------------------------

/**
 * @param tamano   lado del icono en píxeles
 * @param maskable si es true, el fondo llena todo el cuadrado (para que los
 *                 sistemas que recortan el icono no se coman el dibujo)
 */
function dibujar(tamano, maskable) {
  const pixeles = Buffer.alloc(tamano * tamano * 4)
  const MUESTRAS = 3

  const radio = maskable ? 0 : tamano * 0.24
  const grosorBorde = maskable ? 0 : Math.max(1, tamano * 0.012)

  // Proporción del icono que ocupa la corona: menos en el maskable, porque
  // los bordes se recortan
  const ocupacion = maskable ? 0.52 : 0.64
  const anchoCorona = tamano * ocupacion
  const altoCorona = (anchoCorona * (CORONA.y1 - CORONA.y0)) / (CORONA.x1 - CORONA.x0)
  const izquierda = (tamano - anchoCorona) / 2
  const arriba = (tamano - altoCorona) / 2

  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      let sumaR = 0
      let sumaG = 0
      let sumaB = 0
      let sumaA = 0

      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const px = x + (sx + 0.5) / MUESTRAS
          const py = y + (sy + 0.5) / MUESTRAS

          // ¿Está dentro del azulejo redondeado?
          const dx = Math.max(radio - px, 0, px - (tamano - radio))
          const dy = Math.max(radio - py, 0, py - (tamano - radio))
          const fueraEsquina = dx * dx + dy * dy > radio * radio
          if (radio > 0 && fueraEsquina) continue

          // Fondo: degradado en diagonal, como el del diseño
          const t = Math.min(1, (px * 0.34 + py * 0.94) / (tamano * 1.28))
          let color = mezclar(FONDO_ALTO, FONDO_BAJO, t)

          // Reborde dorado
          if (grosorBorde > 0) {
            const distanciaBorde = Math.min(px, py, tamano - px, tamano - py)
            const distanciaEsquina = radio > 0 ? radio - Math.sqrt(dx * dx + dy * dy) : Infinity
            if (Math.min(distanciaBorde, distanciaEsquina) < grosorBorde) color = BORDE
          }

          // La corona encima
          const cx = CORONA.x0 + ((px - izquierda) / anchoCorona) * (CORONA.x1 - CORONA.x0)
          const cy = CORONA.y0 + ((py - arriba) / altoCorona) * (CORONA.y1 - CORONA.y0)
          const que = queHayEn(cx, cy)
          if (que === 'oro') color = colorOro((cy - CORONA.y0) / (CORONA.y1 - CORONA.y0))
          else if (que === 'gema') color = GEMA

          sumaR += color[0]
          sumaG += color[1]
          sumaB += color[2]
          sumaA += 255
        }
      }

      const total = MUESTRAS * MUESTRAS
      const i = (y * tamano + x) * 4
      const alfa = sumaA / total
      if (alfa > 0) {
        // Los canales van premultiplicados por las muestras que había dentro
        pixeles[i] = Math.round(sumaR / (sumaA / 255))
        pixeles[i + 1] = Math.round(sumaG / (sumaA / 255))
        pixeles[i + 2] = Math.round(sumaB / (sumaA / 255))
      }
      pixeles[i + 3] = Math.round(alfa)
    }
  }
  return pixeles
}

// --- Codificación PNG --------------------------------------------------------

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

for (const [nombre, tamano, maskable] of [
  ['pwa-192.png', 192, false],
  ['pwa-512.png', 512, false],
  ['pwa-512-recortable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]) {
  writeFileSync(join(RAIZ, 'public', nombre), comoPng(dibujar(tamano, maskable), tamano))
  console.log(`Creado public/${nombre} (${tamano}×${tamano})${maskable ? ' recortable' : ''}`)
}
