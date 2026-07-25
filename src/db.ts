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
  /** Número de factura simplificada, p. ej. 'T-2026-0001'. Se pone al cobrar */
  numero?: string | null
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

  // --- Tickets en papel ---
  /** Serie de las facturas simplificadas (los tickets), aparte de las facturas */
  serieTicket: string
  contadorTicket: number
  ejercicioTicket: number
  /** Ancho del papel de la impresora, en milímetros: 80 o 58 */
  anchoTicket: number
  /** Frase del final del ticket */
  pieTicket: string
  /**
   * Logo que sale arriba del ticket, guardado como imagen dentro de los ajustes.
   * Vacío = se imprime la corona de Reina dibujada.
   */
  logoTicket: string
  /** 1 = sale el logo en el ticket, 0 = solo el nombre */
  mostrarLogoTicket: number
  /** 1 = al cobrar sale el ticket solo, 0 = solo si se pide */
  imprimirAlCobrar: number

  // --- Cajón portamonedas ---
  /** 1 = el cajón se abre solo al cobrar en efectivo */
  abrirCajonAlCobrar: number
  /**
   * Por dónde se le pide la apertura:
   * 'ayudante' = el programita instalado en Windows (lo normal, para USB)
   * 'serie'    = directamente al puerto serie de la impresora
   */
  modoCajon: string
  /** Velocidad del puerto de la impresora. Casi todas van a 9600 */
  baudiosCajon: number
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

/**
 * La carta real de la Cafetería Reina.
 *
 * Al subir este número se sustituye la carta guardada por esta, una sola vez.
 * Los tickets ya cobrados no se tocan: cada línea guarda su propio nombre y
 * precio, así que el histórico y las facturas siguen siendo fieles.
 */
const VERSION_CARTA = 2

/** El IVA de hostelería. El pan común va aparte, al 4 % */
const IVA = 10

type ProductoInicial = [nombre: string, euros: number, iva?: number]

const CARTA: { categoria: string; productos: ProductoInicial[] }[] = [
  {
    categoria: 'Cafetería',
    productos: [
      ['Café', 1.3],
      ['Cortado', 1.5],
      ['Café con leche', 1.7],
      ['Café americano', 1.3],
      ['Café bombón', 1.7],
      ['Leche con Colacao', 1.7],
      ['Chocolate', 2.3],
      ['Té', 2.0],
      ['Té con leche', 2.5],
      ['Carajillo', 2.0],
      ['Carajillo de whisky', 2.5],
      ['Trifásico', 2.0],
      ['Trifásico de whisky', 2.5],
    ],
  },
  {
    categoria: 'Bollería',
    productos: [
      ['Cruasán', 1.6],
      ['Cruasán de chocolate', 2.0],
      ['Cruasán de cereales', 2.0],
      ['Cruasán de mantequilla', 1.6],
      ['Cruasán de jamón y queso planchado', 2.5],
      ['Magdalena', 2.0],
      ['Dónut normal', 1.6],
      ['Dónut grande', 2.0],
      ['Dónut de chocolate de colores', 1.6],
      ['Berlina', 2.0],
      ['Bola de dónut de coco', 0.65],
      ['Bola de chocolate', 0.65],
      ['Crusán pequeño', 0.5],
      ['Crusán pequeño de chocolate', 0.65],
      ['Crusán de cereales', 0.65],
      ['Chucho', 3.0],
    ],
  },
  {
    categoria: 'Pan',
    productos: [
      // El pan común tributa al 4 %; los panes especiales, al 10 %
      ['Baguette Supreme', 1.0, 4],
      ['Barra pagesa', 1.3, 4],
      ['Gran rústic', 1.7, 4],
      ['Integral', 1.6, 4],
      ['Pagés redondo 1 kg', 3.5, 4],
      ['Pagés redondo medio', 2.6, 4],
      ['Viña 5 cereales', 1.7, 10],
      ['Chía redondo 0,5 kg', 4.2, 10],
      ['Cuarto de chía', 2.6, 10],
      ['Chía cuadrado', 10.0, 10],
      ['Redondo de espelta 0,5 kg', 4.2, 10],
      ['Cuarto de espelta', 2.6, 10],
      ['Pan de nueces', 1.25, 10],
      ['Pan de molde', 3.0, 10],
    ],
  },
  {
    categoria: 'Bocadillos y platos',
    productos: [
      ['Bocadillo caliente', 5.0],
      ['Medio bocadillo caliente', 3.5],
      ['Bocadillo frío', 4.0],
      ['Medio bocadillo frío', 2.5],
      ['Viena redondo', 2.5],
      ['Pulga 2 cortes', 2.0],
      ['Mini pulga', 1.5],
      ['Plato', 5.0],
      ['Medio plato', 3.0],
    ],
  },
  {
    categoria: 'Cervezas y vinos',
    productos: [
      ['Mediana Estrella', 2.2],
      ['Quinto Estrella', 1.9],
      ['Quinto San Miguel', 1.9],
      ['Quinto sin alcohol', 1.9],
      ['Voll-Damm mediana', 2.4],
      ['Lemon cerveza', 2.2],
      ['Cerveza en lata', 2.2],
      ['Vino de mesa', 2.0],
      ['Vino bueno', 3.0],
    ],
  },
  {
    categoria: 'Refrescos y aguas',
    productos: [
      ['Coca-Cola', 2.0],
      ['Fanta', 2.0],
      ['Aquarius', 2.0],
      ['Nestea', 2.0],
      ['Tónica', 2.0],
      ['Bitter', 2.0],
      ['Cacaolat', 2.0],
      ['Zumo', 2.0],
      ['Agua 1,5 l', 1.7],
      ['Agua pequeña', 1.2],
      ['Agua con gas', 2.0],
    ],
  },
  {
    categoria: 'Copas y licores',
    productos: [
      ['María · copa', 2.0],
      ['María · tubo', 3.0],
      ['Pacharán · copa', 2.0],
      ['Pacharán · tubo', 3.0],
      ['Coñac · copa', 2.0],
      ['Coñac · tubo', 3.0],
      ['Anís · copa', 2.0],
      ['Anís · tubo', 3.0],
      ['JB · copa', 2.5],
      ['JB · tubo', 3.5],
      ["Ballantine's · copa", 2.5],
      ["Ballantine's · tubo", 3.5],
      ['Baileys · copa', 2.5],
      ['Baileys · tubo', 3.5],
    ],
  },
  {
    categoria: 'Suplementos',
    productos: [
      ['+ Avena', 0.1],
      ['+ Hielo', 0.1],
      ['+ Queso', 0.5],
    ],
  },
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
  serieTicket: 'T',
  contadorTicket: 0,
  ejercicioTicket: new Date().getFullYear(),
  anchoTicket: 80,
  pieTicket: 'Gracias por su visita',
  logoTicket: '',
  mostrarLogoTicket: 1,
  imprimirAlCobrar: 0,
  abrirCajonAlCobrar: 1,
  modoCajon: 'ayudante',
  baudiosCajon: 9600,
}

/** Vuelca la carta de arriba en la base de datos, sustituyendo la que hubiera */
async function instalarCarta() {
  await db.transaction('rw', db.categorias, db.productos, db.config, async () => {
    await db.categorias.clear()
    await db.productos.clear()

    let orden = 0
    for (const [i, grupo] of CARTA.entries()) {
      const categoriaId = (await db.categorias.add({
        nombre: grupo.categoria,
        color: '#a9762a',
        orden: i + 1,
      })) as number

      await db.productos.bulkAdd(
        grupo.productos.map(([nombre, euros, iva]) => ({
          nombre,
          precio: Math.round(euros * 100),
          categoriaId,
          iva: iva ?? IVA,
          activo: 1,
          orden: ++orden,
        })),
      )
    }

    await db.config.put({ clave: 'versionCarta', valor: VERSION_CARTA })
  })
}

/** Crea la carta, las mesas y los ajustes la primera vez que se abre la app */
export async function inicializarDatos() {
  const version = (await db.config.get('versionCarta'))?.valor
  if (version !== VERSION_CARTA) {
    await instalarCarta()
  }

  if ((await db.mesas.count()) === 0) {
    await db.mesas.bulkAdd(MESAS_INICIALES)
  }

  const ajustes = await db.ajustes.get(1)
  if (!ajustes) {
    await db.ajustes.add(AJUSTES_POR_DEFECTO)
  } else {
    // Rellena los ajustes que se hayan añadido después de la primera instalación
    const faltantes = Object.fromEntries(
      Object.entries(AJUSTES_POR_DEFECTO).filter(
        ([clave]) => ajustes[clave as keyof Ajustes] === undefined,
      ),
    )
    if (Object.keys(faltantes).length > 0) await db.ajustes.update(1, faltantes)
  }
}
