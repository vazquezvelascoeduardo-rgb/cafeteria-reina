# TPV Cafetería

Aplicación para llevar la cafetería: mesas, cobros con cálculo de cambio, cierre de caja,
clientes a cuenta, facturas trimestrales e informes de ventas.

Funciona **sin internet**. Todos los datos se guardan dentro del propio ordenador.

---

## Cómo se usa en el día a día

| Pestaña      | Para qué sirve                                                                     |
| ------------ | ---------------------------------------------------------------------------------- |
| **Mesas**    | Ver qué mesas están ocupadas, tomar la comanda y cobrar                            |
| **Caja**     | Cuánto se ha hecho hoy en efectivo y tarjeta, y cuadrar el cajón                   |
| **Clientes** | Clientes que consumen a cuenta y se les factura después                            |
| **Facturas** | Emitir la factura de un periodo e imprimirla o guardarla en PDF                    |
| **Informes** | Ventas por día, por mes, días más fuertes y productos más vendidos                 |
| **Ajustes**  | Datos fiscales, carta y precios, mesas y copias de seguridad                        |

### Cobrar una mesa

1. Toca la mesa → toca los productos → se van sumando solos.
2. **Cobrar** → elige tarjeta, o efectivo indicando con cuánto paga el cliente.
3. La app dice el cambio exacto y en qué monedas darlo.

### Facturar al cliente trimestral

1. Cuando ese cliente consume, en vez de **Cobrar** se pulsa **A cuenta** y se elige su nombre.
2. Cada tres meses: **Facturas → Nueva factura → Trimestre pasado → Emitir factura**.
3. Sale la factura en A4 con numeración correlativa y el IVA desglosado, lista para
   imprimir o guardar en PDF (en el diálogo de impresión, "Guardar como PDF").

Las facturas emitidas no se pueden modificar. Si te equivocas, solo se puede anular la
última emitida, para no dejar huecos en la numeración.

### Antes de emitir la primera factura

Rellena en **Ajustes → Datos de la cafetería** el nombre y el NIF del negocio. Sin eso la
factura no es válida.

---

## Copias de seguridad — importante

Los datos están **solo en este ordenador**. Si se estropea y no hay copia, se pierden.

### Lo que hay que hacer una sola vez

**Ajustes → Copia de seguridad → Elegir carpeta para las copias**, y elige una carpeta
**dentro de OneDrive** (por ejemplo `OneDrive → Documentos → Cafetería`).

A partir de ahí, cada día al abrir la aplicación se guardan solos en esa carpeta:

- `copia-cafeteria-AAAA-MM-DD.json` — la copia completa, la que sirve para restaurar
- `resumen-por-dias.csv` — ventas de cada día en efectivo, tarjeta y a cuenta
- `tickets.csv` — todos los tickets con hora, mesa y forma de pago
- `detalle-de-consumos.csv` — qué se ha consumido, línea a línea
- `productos-mas-vendidos.csv` — ranking de productos
- `facturas-emitidas.csv` — todas las facturas con base imponible e IVA

Los `.csv` se abren con Excel de un doble clic. Como la carpeta está en OneDrive, Windows
sube todo eso a la nube sin que nadie tenga que acordarse.

Requiere abrir la aplicación con **Chrome** o **Edge** (Firefox y Safari no permiten a una
web escribir en carpetas). Si el navegador pide permiso otra vez tras una actualización,
basta con entrar en Ajustes y pulsar "Guardar copia ahora".

### Si no se quiere usar la carpeta automática

En la misma pantalla están los botones para descargar a mano la copia de seguridad y las
hojas de Excel, y guardarlas en un pendrive o mandarlas por correo.

---

## Publicarla en internet (recomendado)

No hace falta dominio propio ni pagar nada. Con una URL gratuita basta, y así la
aplicación se actualiza sola y se puede instalar también en el móvil.

La forma más rápida, sin instalar nada:

1. `npm run build` en este proyecto.
2. Entrar en <https://app.netlify.com/drop>.
3. Arrastrar ahí la carpeta `dist`.
4. Netlify devuelve una dirección tipo `https://algo-aleatorio.netlify.app`. Desde la cuenta
   se puede cambiar por algo como `cafeteria-mama.netlify.app`.

En el ordenador de la cafetería: abrir esa dirección con Edge o Chrome y **⋮ → Instalar
aplicación**. Queda el icono en el escritorio y a partir de ahí funciona aunque se caiga
internet, porque la primera visita se guarda entera en el ordenador.

> **Importante:** los datos se guardan atados a la dirección desde la que se abre la
> aplicación. Cambiar de dirección más adelante (de `localhost` a Netlify, por ejemplo)
> hace que aparezca vacía. Los datos no se pierden, pero hay que pasarlos a mano:
> **Ajustes → Copia de seguridad → Descargar** en la dirección vieja y **Restaurar** en la
> nueva. Conviene decidir la dirección definitiva antes de empezar a usarla en serio.

## Para el desarrollador

```bash
npm install          # instalar dependencias
npm run dev          # desarrollo en http://localhost:5176
npm run build        # compila a dist/
npm run preview      # sirve dist/ para probar la versión final
node scripts/generar-iconos.mjs   # regenera los iconos PNG de la app
```

**Stack:** Vite + React + TypeScript + Tailwind v4. Datos en IndexedDB vía Dexie.
PWA instalable y offline con vite-plugin-pwa.

### Detalles de implementación que conviene conocer

- **Todo el dinero se guarda en céntimos enteros** (`src/lib/dinero.ts`). Nunca en euros
  decimales: al sumar cientos de líneas en una factura, los decimales acumulan error.
- **El IVA se desglosa por grupo, no línea a línea**, que es como debe hacerse en una
  factura para que no descuadre por céntimos.
- **La numeración de facturas se reserva dentro de la misma transacción** que marca los
  consumos como facturados (`emitirFactura` en `src/lib/acciones.ts`), para que nunca se
  repita un número ni se facture dos veces lo mismo.
- Las fechas de cierre de caja usan **día local**, nunca UTC, o la caja no cuadraría de noche.
