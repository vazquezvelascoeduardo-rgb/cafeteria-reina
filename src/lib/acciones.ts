import {
  db,
  type Cliente,
  type Factura,
  type LineaFactura,
  type LineaTicket,
  type MetodoPago,
  type Pago,
  type Producto,
  type Ticket,
} from '../db'
import { desgloseCompleto, totalLineas } from './dinero'
import { aDiaLocal } from './fechas'

// ---------------------------------------------------------------------------
// Mesas y tickets
// ---------------------------------------------------------------------------

/** Devuelve el ticket abierto de una mesa, o lo crea si no existe */
export async function abrirTicketDeMesa(mesaId: number, mesaNombre: string): Promise<number> {
  const existente = await db.tickets.where({ mesaId }).and((t) => t.estado === 'abierto').first()
  if (existente?.id) return existente.id

  const nuevo: Omit<Ticket, 'id'> = {
    mesaId,
    mesaNombre,
    clienteId: null,
    clienteNombre: null,
    lineas: [],
    estado: 'abierto',
    abiertoEn: Date.now(),
    cerradoEn: null,
    metodoPago: null,
    total: 0,
    recibido: null,
    cambio: null,
    facturaId: null,
    dia: '',
    nota: '',
  }
  return (await db.tickets.add(nuevo as Ticket)) as number
}

/** Ticket sin mesa asignada, para cobrar en barra sobre la marcha */
export async function crearTicketSuelto(): Promise<number> {
  const nuevo: Omit<Ticket, 'id'> = {
    mesaId: null,
    mesaNombre: 'Venta rápida',
    clienteId: null,
    clienteNombre: null,
    lineas: [],
    estado: 'abierto',
    abiertoEn: Date.now(),
    cerradoEn: null,
    metodoPago: null,
    total: 0,
    recibido: null,
    cambio: null,
    facturaId: null,
    dia: '',
    nota: '',
  }
  return (await db.tickets.add(nuevo as Ticket)) as number
}

/** Añade un producto al ticket. Si ya está en la comanda, sube la cantidad */
export async function anadirProducto(ticketId: number, producto: Producto) {
  await db.transaction('rw', db.tickets, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return

    const lineas = [...ticket.lineas]
    const i = lineas.findIndex(
      (l) => l.productoId === producto.id && l.precio === producto.precio && l.iva === producto.iva,
    )
    if (i >= 0) {
      lineas[i] = { ...lineas[i], cantidad: lineas[i].cantidad + 1 }
    } else {
      lineas.push({
        productoId: producto.id ?? null,
        nombre: producto.nombre,
        precio: producto.precio,
        iva: producto.iva,
        cantidad: 1,
      })
    }
    await db.tickets.update(ticketId, { lineas, total: totalLineas(lineas) })
  })
}

/** Añade una línea suelta escrita a mano (un producto que no está en la carta) */
export async function anadirLineaLibre(ticketId: number, linea: LineaTicket) {
  await db.transaction('rw', db.tickets, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return
    const lineas = [...ticket.lineas, linea]
    await db.tickets.update(ticketId, { lineas, total: totalLineas(lineas) })
  })
}

/** Suma o resta unidades a una línea. Si llega a 0, la línea desaparece */
export async function cambiarCantidad(ticketId: number, indice: number, delta: number) {
  await db.transaction('rw', db.tickets, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return

    const lineas = [...ticket.lineas]
    const linea = lineas[indice]
    if (!linea) return

    const cantidad = linea.cantidad + delta
    if (cantidad <= 0) {
      lineas.splice(indice, 1)
    } else {
      lineas[indice] = { ...linea, cantidad }
    }
    await db.tickets.update(ticketId, { lineas, total: totalLineas(lineas) })
  })
}

export async function quitarLinea(ticketId: number, indice: number) {
  await db.transaction('rw', db.tickets, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return
    const lineas = ticket.lineas.filter((_, i) => i !== indice)
    await db.tickets.update(ticketId, { lineas, total: totalLineas(lineas) })
  })
}

/** Vacía la comanda y borra el ticket (mesa libre otra vez) */
export async function anularTicket(ticketId: number) {
  const ticket = await db.tickets.get(ticketId)
  if (!ticket || ticket.estado !== 'abierto') return
  await db.tickets.delete(ticketId)
}

/** Mueve toda la comanda de una mesa a otra */
export async function moverTicket(ticketId: number, mesaId: number, mesaNombre: string) {
  await db.transaction('rw', db.tickets, async () => {
    const destino = await db.tickets.where({ mesaId }).and((t) => t.estado === 'abierto').first()
    const origen = await db.tickets.get(ticketId)
    if (!origen) return

    if (destino?.id) {
      // La mesa destino ya tenía comanda: se juntan las dos
      const lineas = [...destino.lineas, ...origen.lineas]
      await db.tickets.update(destino.id, { lineas, total: totalLineas(lineas) })
      await db.tickets.delete(ticketId)
    } else {
      await db.tickets.update(ticketId, { mesaId, mesaNombre })
    }
  })
}

/**
 * Reserva el siguiente número de factura simplificada.
 * Se llama siempre dentro de una transacción, para que no se repita nunca.
 */
async function reservarNumero(dia: string): Promise<string | null> {
  const ajustes = await db.ajustes.get(1)
  if (!ajustes) return null

  const ejercicio = Number(dia.slice(0, 4))
  const contador = ajustes.ejercicioTicket === ejercicio ? ajustes.contadorTicket + 1 : 1
  await db.ajustes.update(1, { contadorTicket: contador, ejercicioTicket: ejercicio })

  return `${ajustes.serieTicket}-${ejercicio}-${String(contador).padStart(4, '0')}`
}

/**
 * Cierra el ticket como cobrado (efectivo o tarjeta) y le asigna su número de
 * factura simplificada, que es lo que va impreso en el papel que se entrega.
 */
export async function cobrarTicket(
  ticketId: number,
  metodoPago: Exclude<MetodoPago, 'cuenta'>,
  recibido: number | null,
): Promise<Ticket | null> {
  return db.transaction('rw', db.tickets, db.ajustes, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return null

    const dia = aDiaLocal()
    const numero = ticket.numero ?? (await reservarNumero(dia))
    const total = totalLineas(ticket.lineas)

    const cambios = {
      numero,
      estado: 'cobrado' as const,
      metodoPago,
      pagos: undefined,
      total,
      recibido: metodoPago === 'efectivo' ? recibido : null,
      cambio: metodoPago === 'efectivo' && recibido !== null ? recibido - total : null,
      cerradoEn: Date.now(),
      dia,
    }
    await db.tickets.update(ticketId, cambios)
    return { ...ticket, ...cambios }
  })
}

/**
 * Cierra el ticket cuando la cuenta se ha repartido a partes iguales y cada
 * uno ha pagado como ha querido.
 *
 * Sale un único ticket, con el detalle de lo consumido intacto, pero anotando
 * cuánto entró en efectivo y cuánto con tarjeta para que la caja cuadre.
 */
export async function cobrarTicketRepartido(
  ticketId: number,
  pagos: Pago[],
): Promise<Ticket | null> {
  return db.transaction('rw', db.tickets, db.ajustes, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return null

    const dia = aDiaLocal()
    const numero = ticket.numero ?? (await reservarNumero(dia))
    const total = totalLineas(ticket.lineas)

    // Si al final todos pagaron igual, se guarda como un cobro normal
    const metodos = new Set(pagos.map((p) => p.metodo))
    const unicoMetodo = metodos.size === 1 ? [...metodos][0] : null

    const cambios = {
      numero,
      estado: 'cobrado' as const,
      metodoPago: unicoMetodo ?? ('efectivo' as MetodoPago),
      pagos: unicoMetodo ? undefined : pagos,
      total,
      recibido: null,
      cambio: null,
      cerradoEn: Date.now(),
      dia,
    }
    await db.tickets.update(ticketId, cambios)
    return { ...ticket, ...cambios }
  })
}

/** Lo que se lleva una persona de la cuenta: cuántas unidades de cada línea */
export type Seleccion = { indice: number; cantidad: number }[]

/**
 * Cobra solo una parte de la comanda: lo que ha consumido esa persona.
 *
 * Esas líneas salen de la mesa y forman su propio ticket cobrado, con su
 * número. Lo que queda sigue abierto para los demás. Si no queda nada, la mesa
 * se libera.
 */
export async function cobrarLoSuyo(
  ticketId: number,
  seleccion: Seleccion,
  metodoPago: Exclude<MetodoPago, 'cuenta'>,
  recibido: number | null,
): Promise<Ticket | null> {
  return db.transaction('rw', db.tickets, db.ajustes, async () => {
    const ticket = await db.tickets.get(ticketId)
    if (!ticket || ticket.estado !== 'abierto') return null

    const quedan = ticket.lineas.map((l) => ({ ...l }))
    const seLleva: LineaTicket[] = []

    for (const { indice, cantidad } of seleccion) {
      const linea = quedan[indice]
      if (!linea || cantidad <= 0) continue

      const unidades = Math.min(cantidad, linea.cantidad)
      seLleva.push({ ...linea, cantidad: unidades })
      linea.cantidad -= unidades
    }

    if (seLleva.length === 0) return null

    const dia = aDiaLocal()
    const numero = await reservarNumero(dia)
    const total = totalLineas(seLleva)

    const suyo: Omit<Ticket, 'id'> = {
      numero,
      mesaId: null,
      mesaNombre: ticket.mesaNombre,
      clienteId: null,
      clienteNombre: null,
      lineas: seLleva,
      estado: 'cobrado',
      abiertoEn: ticket.abiertoEn,
      cerradoEn: Date.now(),
      metodoPago,
      total,
      recibido: metodoPago === 'efectivo' ? recibido : null,
      cambio: metodoPago === 'efectivo' && recibido !== null ? recibido - total : null,
      facturaId: null,
      dia,
      nota: '',
    }

    const nuevoId = (await db.tickets.add(suyo as Ticket)) as number

    // Lo que sobra se queda en la mesa; si no sobra nada, la mesa queda libre
    const restantes = quedan.filter((l) => l.cantidad > 0)
    if (restantes.length === 0) {
      await db.tickets.delete(ticketId)
    } else {
      await db.tickets.update(ticketId, {
        lineas: restantes,
        total: totalLineas(restantes),
      })
    }

    return { ...suyo, id: nuevoId }
  })
}

/** Cierra el ticket como "a cuenta" de un cliente, pendiente de facturar */
export async function apuntarACuenta(ticketId: number, cliente: Cliente) {
  const ticket = await db.tickets.get(ticketId)
  if (!ticket || ticket.estado !== 'abierto') return

  await db.tickets.update(ticketId, {
    estado: 'a_cuenta',
    metodoPago: 'cuenta',
    clienteId: cliente.id ?? null,
    clienteNombre: cliente.nombre,
    total: totalLineas(ticket.lineas),
    cerradoEn: Date.now(),
    dia: aDiaLocal(),
  })
}

/** Deshace un cobro: el ticket vuelve a estar abierto en su mesa */
export async function reabrirTicket(ticketId: number) {
  const ticket = await db.tickets.get(ticketId)
  if (!ticket || ticket.estado === 'abierto') return
  if (ticket.facturaId !== null) return // ya facturado, no se toca

  await db.tickets.update(ticketId, {
    estado: 'abierto',
    metodoPago: null,
    recibido: null,
    cambio: null,
    cerradoEn: null,
    dia: '',
    clienteId: null,
    clienteNombre: null,
  })
}

// ---------------------------------------------------------------------------
// Facturación
// ---------------------------------------------------------------------------

/** Tickets a cuenta de un cliente, dentro del rango, todavía sin facturar */
export async function ticketsPendientesDeFacturar(clienteId: number, desde: string, hasta: string) {
  const tickets = await db.tickets.where({ clienteId }).toArray()
  return tickets
    .filter((t) => t.estado === 'a_cuenta' && t.facturaId === null && t.dia >= desde && t.dia <= hasta)
    .sort((a, b) => (a.cerradoEn ?? 0) - (b.cerradoEn ?? 0))
}

/** Agrupa los consumos de varios tickets en líneas de factura legibles */
export function agruparEnLineasDeFactura(tickets: Ticket[]): LineaFactura[] {
  const grupos = new Map<string, LineaFactura>()

  for (const ticket of tickets) {
    for (const linea of ticket.lineas) {
      const clave = `${linea.nombre}|${linea.precio}|${linea.iva}`
      const existente = grupos.get(clave)
      if (existente) {
        existente.cantidad += linea.cantidad
        existente.importe += linea.precio * linea.cantidad
      } else {
        grupos.set(clave, {
          descripcion: linea.nombre,
          cantidad: linea.cantidad,
          precio: linea.precio,
          iva: linea.iva,
          importe: linea.precio * linea.cantidad,
        })
      }
    }
  }

  return [...grupos.values()].sort((a, b) => b.importe - a.importe)
}

export class SinConsumosError extends Error {}

/**
 * Emite la factura de un cliente por un periodo.
 * El número se reserva dentro de la misma transacción que marca los tickets,
 * así nunca se repite un número ni se factura dos veces el mismo consumo.
 */
export async function emitirFactura(opciones: {
  cliente: Cliente
  desde: string
  hasta: string
  fecha?: string
  observaciones?: string
}): Promise<Factura> {
  const { cliente, desde, hasta } = opciones
  if (cliente.id === undefined) throw new Error('El cliente no está guardado')

  return db.transaction('rw', db.tickets, db.facturas, db.ajustes, async () => {
    const ajustes = await db.ajustes.get(1)
    if (!ajustes) throw new Error('Faltan los ajustes')

    const todos = await db.tickets.where({ clienteId: cliente.id! }).toArray()
    const tickets = todos
      .filter((t) => t.estado === 'a_cuenta' && t.facturaId === null && t.dia >= desde && t.dia <= hasta)
      .sort((a, b) => (a.cerradoEn ?? 0) - (b.cerradoEn ?? 0))

    if (tickets.length === 0) {
      throw new SinConsumosError('No hay consumos pendientes de facturar en ese periodo')
    }

    const fecha = opciones.fecha ?? aDiaLocal()
    const ejercicio = Number(fecha.slice(0, 4))

    // El contador vuelve a 1 en cada ejercicio
    const contador = ajustes.ejercicioFactura === ejercicio ? ajustes.contadorFactura + 1 : 1
    const numero = `${ajustes.serieFactura}-${ejercicio}-${String(contador).padStart(4, '0')}`

    const lineas = agruparEnLineasDeFactura(tickets)
    const desglose = desgloseCompleto(lineas)
    const base = desglose.reduce((s, d) => s + d.base, 0)
    const cuota = desglose.reduce((s, d) => s + d.cuota, 0)

    const factura: Omit<Factura, 'id'> = {
      numero,
      serie: ajustes.serieFactura,
      ejercicio,
      contador,
      clienteId: cliente.id!,
      cliente: { ...cliente },
      emisor: { ...ajustes.emisor },
      fecha,
      desde,
      hasta,
      lineas,
      desglose,
      base,
      cuota,
      total: base + cuota,
      ticketIds: tickets.map((t) => t.id!),
      creadaEn: Date.now(),
      observaciones: opciones.observaciones ?? '',
    }

    const facturaId = (await db.facturas.add(factura as Factura)) as number
    await Promise.all(tickets.map((t) => db.tickets.update(t.id!, { facturaId })))
    await db.ajustes.update(1, { contadorFactura: contador, ejercicioFactura: ejercicio })

    return { ...factura, id: facturaId }
  })
}

/**
 * Anula una factura: los consumos vuelven a quedar pendientes.
 * Solo se permite en la última emitida, para no dejar huecos en la numeración.
 */
export async function anularUltimaFactura(facturaId: number) {
  await db.transaction('rw', db.tickets, db.facturas, db.ajustes, async () => {
    const factura = await db.facturas.get(facturaId)
    if (!factura) return

    const ajustes = await db.ajustes.get(1)
    const esLaUltima =
      ajustes?.ejercicioFactura === factura.ejercicio && ajustes?.contadorFactura === factura.contador
    if (!esLaUltima) throw new Error('Solo se puede anular la última factura emitida')

    await Promise.all(factura.ticketIds.map((id) => db.tickets.update(id, { facturaId: null })))
    await db.facturas.delete(facturaId)
    await db.ajustes.update(1, { contadorFactura: factura.contador - 1 })
  })
}

// ---------------------------------------------------------------------------
// Copia de seguridad
// ---------------------------------------------------------------------------

export type Copia = {
  formato: 'tpv-cafeteria'
  version: number
  creada: string
  datos: Record<string, unknown[]>
}

export async function exportarCopia(): Promise<Copia> {
  const [categorias, productos, mesas, tickets, clientes, facturas, ajustes] = await Promise.all([
    db.categorias.toArray(),
    db.productos.toArray(),
    db.mesas.toArray(),
    db.tickets.toArray(),
    db.clientes.toArray(),
    db.facturas.toArray(),
    db.ajustes.toArray(),
  ])
  return {
    formato: 'tpv-cafeteria',
    version: 1,
    creada: new Date().toISOString(),
    datos: { categorias, productos, mesas, tickets, clientes, facturas, ajustes },
  }
}

/** Sustituye TODO el contenido de la app por el de la copia */
export async function importarCopia(copia: Copia) {
  if (copia?.formato !== 'tpv-cafeteria') {
    throw new Error('Ese archivo no es una copia de seguridad de la cafetería')
  }
  const d = copia.datos
  await db.transaction(
    'rw',
    [db.categorias, db.productos, db.mesas, db.tickets, db.clientes, db.facturas, db.ajustes],
    async () => {
      await Promise.all([
        db.categorias.clear(),
        db.productos.clear(),
        db.mesas.clear(),
        db.tickets.clear(),
        db.clientes.clear(),
        db.facturas.clear(),
        db.ajustes.clear(),
      ])
      await db.categorias.bulkAdd((d.categorias ?? []) as never[])
      await db.productos.bulkAdd((d.productos ?? []) as never[])
      await db.mesas.bulkAdd((d.mesas ?? []) as never[])
      await db.tickets.bulkAdd((d.tickets ?? []) as never[])
      await db.clientes.bulkAdd((d.clientes ?? []) as never[])
      await db.facturas.bulkAdd((d.facturas ?? []) as never[])
      await db.ajustes.bulkAdd((d.ajustes ?? []) as never[])
    },
  )
}
