/**
 * Prepara una imagen para el ticket.
 *
 * Las impresoras térmicas de 80 mm imprimen a unos 576 puntos de ancho, así que
 * no tiene sentido guardar una foto de varios megas: se reduce a ese ancho y se
 * guarda en blanco y negro, que es lo único que sabe imprimir el papel térmico.
 * Además así el logo ocupa unos pocos kilobytes dentro de la copia de seguridad.
 */

const ANCHO_MAXIMO = 576

export async function prepararLogo(archivo: File): Promise<string> {
  const imagen = await cargarImagen(archivo)

  const escala = Math.min(1, ANCHO_MAXIMO / imagen.width)
  const ancho = Math.max(1, Math.round(imagen.width * escala))
  const alto = Math.max(1, Math.round(imagen.height * escala))

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto

  const pincel = lienzo.getContext('2d')
  if (!pincel) throw new Error('No se ha podido preparar la imagen')

  // Fondo blanco: si el logo es transparente, en el papel sería invisible
  pincel.fillStyle = '#ffffff'
  pincel.fillRect(0, 0, ancho, alto)
  pincel.drawImage(imagen, 0, 0, ancho, alto)

  // A grises, subiendo el contraste para que no salga una mancha gris
  const datos = pincel.getImageData(0, 0, ancho, alto)
  const p = datos.data
  for (let i = 0; i < p.length; i += 4) {
    const gris = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    const contrastado = Math.max(0, Math.min(255, (gris - 128) * 1.35 + 128))
    p[i] = p[i + 1] = p[i + 2] = contrastado
  }
  pincel.putImageData(datos, 0, 0)

  return lienzo.toDataURL('image/png')
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se ha podido leer el archivo'))
    lector.onload = () => {
      const imagen = new Image()
      imagen.onload = () => resolver(imagen)
      imagen.onerror = () => rechazar(new Error('Ese archivo no es una imagen que se pueda usar'))
      imagen.src = lector.result as string
    }
    lector.readAsDataURL(archivo)
  })
}
