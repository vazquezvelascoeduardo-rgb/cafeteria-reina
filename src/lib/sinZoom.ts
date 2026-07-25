/**
 * Deja la pantalla quieta.
 *
 * En una pantalla táctil se amplía la página sin querer constantemente: con dos
 * dedos, con un doble toque, o rozando el ratón con la tecla Control pulsada.
 * Luego hay que adivinar cómo se vuelve al tamaño normal en mitad del servicio.
 *
 * Los gestos con los dedos ya los corta el CSS (touch-action). Aquí se cierran
 * las otras puertas: la rueda del ratón con Control y los atajos de teclado.
 */
export function bloquearZoom() {
  // Rueda del ratón con Control: el zoom clásico de escritorio
  window.addEventListener(
    'wheel',
    (evento) => {
      if (evento.ctrlKey) evento.preventDefault()
    },
    { passive: false },
  )

  // Control con +, -, o 0
  window.addEventListener('keydown', (evento) => {
    if (!evento.ctrlKey && !evento.metaKey) return
    if (['+', '-', '=', '0'].includes(evento.key)) evento.preventDefault()
  })

  // Pellizco en los navegadores de Apple, que no hacen caso a touch-action
  for (const gesto of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(gesto, (evento) => evento.preventDefault())
  }
}
