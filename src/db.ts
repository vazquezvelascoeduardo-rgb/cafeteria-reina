import Dexie, { type EntityTable } from 'dexie'

/**
 * IMPORTANTE: todo el dinero se guarda en CÉNTIMOS (números enteros).
 * Así nunca hay errores de decimales al sumar cientos de líneas en una factura.
 * Para mostrarlo se usa formatearEuros() de lib/dinero.ts
 */

export type Categoria = {
  id?: number
  nombre: string
  color: string
  orden: number
}

export type Producto = {
  id?: number
  nombre: string
  /** En céntimos, IVA incluido (el precio de la carta) */
  precio: number
  categoriaId: number
  /** Porcentaje de IVA: 10 para hostelería, 21, 4... */
  iva: number
  /** 1 = se muestra en la carta, 0 = oculto. Dexie no indexa booleanos */
  activo: number
  orden: number
}

export type Mesa = {
  id?: number
  nombre: string
  zona: string
  orden: number
}

export type LineaTicket = {
  productoId: number | null
  nombre: string
  /** Céntimos, IVA incluido, por unidad */
  precio: number
  iva: number
  cantidad: number
}

export type EstadoTicket = 'abierto' | 'cobrado' | 'a_cuenta'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'cuenta'

export type Ticket = {
  id?: number
  mesaId: number | null
  mesaNombre: string
  clienteId: number | null
  clienteNombre: string | null
  lineas: LineaTicket[]
  estado: EstadoTicket
  abiertoEn: number
  cerradoEn: number | null
  metodoPago: MetodoPago | null
  /** Céntimos */
  total: number
  recibido: number | null
  cambio: number | null
  /** id de la factura donde se incluyó (solo tickets 'a_cuenta') */
  facturaId: number | null
  /** 'YYYY-MM-DD' del cobro, para el cierre de caja */
  dia: string
  nota: string
}

export type Cliente = {
  id?: number
  nombre: string
  nif: string
  direccion: string
  cp: string
  ciudad: string
  provincia: string
  email: string
  telefono: string
  notas: string
}

export type LineaFactura = {
  descripcion: string
  cantidad: number
  /** Céntimos, IVA incluido, por unidad */
  precio: number
  iva: number
  /** Céntimos, IVA incluido */
  importe: number
}

export type DesgloseIva = {
  iva: number
  base: number
  cuota: number
}

export type DatosEmisor = {
  nombre: string
  nif: string
  direccion: string
  cp: string
  ciudad: string
  provincia: string
  telefono: string
  email: string
}

export type Factura = {
  id?: number
  numero: string
  serie: string
  ejercicio: number
  contador: number
  clienteId: number
  /** Copia congelada de los datos en el momento de emitir: una factura no cambia nunca */
  cliente: Cliente
  emisor: DatosEmisor
  fecha: string
  desde: string
  hasta: string
  lineas: LineaFactura[]
  desglose: DesgloseIva[]
  base: number
  cuota: number
  total: number
  ticketIds: number[]
  creadaEn: number
  observaciones: string
}

export type Ajustes = {
  id: number
  emisor: DatosEmisor
  serieFactura: string
  /** Último número usado en el ejercicio en curso */
  contadorFactura: number
  ejercicioFactura: number
  ivaPorDefecto: number
}

/**
 * Almacén de cosas sueltas que no son datos del negocio: la carpeta elegida
 * para las copias automáticas, el día de la última copia hecha, etc.
 */
export type Config = {
  clave: string
  valor: unknown
}

const db = new Dexie('TpvCafeteria') as Dexie & {
  categorias: EntityTable<Categoria, 'id'>
  productos: EntityTable<Producto, 'id'>
  mesas: EntityTable<Mesa, 'id'>
  tickets: EntityTable<Ticket, 'id'>
  clientes: EntityTable<Cliente, 'id'>
  facturas: EntityTable<Factura, 'id'>
  ajustes: EntityTable<Ajustes, 'id'>
  config: EntityTable<Config, 'clave'>
}

db.version(1).stores({
  categorias: '++id, orden',
  productos: '++id, categoriaId, activo, orden',
  mesas: '++id, orden',
  tickets: '++id, estado, mesaId, clienteId, dia, cerradoEn, facturaId',
  clientes: '++id, nombre',
  facturas: '++id, numero, clienteId, fecha',
  ajustes: 'id',
})

db.version(2).stores({
  config: 'clave',
})

export { db }

// ---------------------------------------------------------------------------
// Datos de arranque: una carta típica de cafetería, para que no empiece vacío
// ---------------------------------------------------------------------------

const CATEGORIAS_INICIALES: Omit<Categoria, 'id'>[] = [
  { nombre: 'Cafés e infusiones', color: '#7c4a2d', orden: 1 },
  { nombre: 'Refrescos y zumos', color: '#c2410c', orden: 2 },
  { nombre: 'Cervezas y vinos', color: '#a16207', orden: 3 },
  { nombre: 'Bocadillos', color: '#4d7c0f', orden: 4 },
  { nombre: 'Tapas y raciones', color: '#0f766e', orden: 5 },
  { nombre: 'Bollería y postres', color: '#9d174d', orden: 6 },
]

/** [nombre, precio en euros, índice de categoría (0..5)] */
const PRODUCTOS_INICIALES: [string, number, number][] = [
  ['Café solo', 1.3, 0],
  ['Cortado', 1.4, 0],
  ['Café con leche', 1.6, 0],
  ['Café doble', 1.8, 0],
  ['Descafeinado', 1.6, 0],
  ['Carajillo', 2.2, 0],
  ['Colacao', 1.8, 0],
  ['Té / Infusión', 1.6, 0],
  ['Leche vaso', 1.4, 0],

  ['Agua pequeña', 1.2, 1],
  ['Agua grande', 1.8, 1],
  ['Refresco lata', 2.0, 1],
  ['Zumo natural', 2.8, 1],
  ['Zumo botella', 2.0, 1],
  ['Bitter / Tónica', 2.2, 1],

  ['Caña', 1.8, 2],
  ['Doble', 2.6, 2],
  ['Quinto', 2.0, 2],
  ['Cerveza sin', 2.0, 2],
  ['Copa de vino', 2.2, 2],
  ['Vermut', 2.8, 2],

  ['Bocadillo tortilla', 3.5, 3],
  ['Bocadillo jamón', 4.5, 3],
  ['Bocadillo lomo', 4.2, 3],
  ['Bocadillo queso', 3.8, 3],
  ['Pulguita', 2.5, 3],
  ['Tostada con tomate', 2.5, 3],

  ['Tortilla de patatas', 3.0, 4],
  ['Patatas bravas', 4.5, 4],
  ['Croquetas', 5.0, 4],
  ['Ensaladilla', 4.5, 4],
  ['Aceitunas', 2.0, 4],
  ['Tabla de ibéricos', 9.0, 4],

  ['Croissant', 1.8, 5],
  ['Napolitana', 1.9, 5],
  ['Palmera', 2.0, 5],
  ['Tarta de queso', 3.5, 5],
  ['Flan', 3.0, 5],
  ['Helado', 3.0, 5],
]

const MESAS_INICIALES: Omit<Mesa, 'id'>[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    nombre: `Mesa ${i + 1}`,
    zona: 'Salón',
    orden: i + 1,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    nombre: `Terraza ${i + 1}`,
    zona: 'Terraza',
    orden: 20 + i,
  })),
  { nombre: 'Barra', zona: 'Barra', orden: 40 },
]

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 1,
  emisor: {
    nombre: '',
    nif: '',
    direccion: '',
    cp: '',
    ciudad: '',
    provincia: '',
    telefono: '',
    email: '',
  },
  serieFactura: 'A',
  contadorFactura: 0,
  ejercicioFactura: new Date().getFullYear(),
  ivaPorDefecto: 10,
}

/** Crea la carta, las mesas y los ajustes la primera vez que se abre la app */
export async function inicializarDatos() {
  const yaHayCategorias = await db.categorias.count()

  if (yaHayCategorias === 0) {
    const ids = await db.categorias.bulkAdd(CATEGORIAS_INICIALES, { allKeys: true })
    await db.productos.bulkAdd(
      PRODUCTOS_INICIALES.map(([nombre, euros, cat], i) => ({
        nombre,
        precio: Math.round(euros * 100),
        categoriaId: ids[cat] as number,
        iva: 10,
        activo: 1,
        orden: i + 1,
      })),
    )
  }

  if ((await db.mesas.count()) === 0) {
    await db.mesas.bulkAdd(MESAS_INICIALES)
  }

  if (!(await db.ajustes.get(1))) {
    await db.ajustes.add(AJUSTES_POR_DEFECTO)
  }
}
