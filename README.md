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

Los datos están **solo en este ordenador**. Si se estropea, se pierden.

Una vez por semana: **Ajustes → Copia de seguridad → Descargar copia** y guarda ese archivo
en un pendrive o mándatelo por correo. Con él se recupera todo en otro ordenador.

---

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
