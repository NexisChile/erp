# El sistema de diseño

Este documento existe porque todo el razonamiento de la interfaz vivía en
mensajes de commit y comentarios de CSS. Un sistema que no está escrito se
deshace solo: alguien añade un `box-shadow` porque «la tarjeta se ve plana» y
sin saberlo revierte una capa entera.

No es un manual de estilo aspiracional. Es lo que la aplicación **hace hoy**,
por qué, y qué hay que saber para no romperlo.

---

## 1. Las cinco reglas

Si sólo lees una sección, que sea esta.

**Un solo acento.** Hay un color de acento —azul tinta— y tres colores
semánticos: verde *sube*, rojo *baja*, ámbar *revisar*. Nada más. Antes había
seis acentos (azul, turquesa, morado, ámbar, verde, rosa) y ninguno significaba
nada, porque cuando todo tiene color el color deja de informar.

**El valor no lleva color.** Una cifra va en el color del texto. El color se
reserva para lo que tiene una lectura: una variación que sube, un margen bajo,
un estado que hay que mirar. Pintar de verde un `$0` bajo «Negocios ganados»
dice lo contrario de lo que pasa.

**La jerarquía la hace el aire, no la elevación.** Casi nada lleva sombra. Sólo
la llevan las tres cosas que de verdad flotan sobre el contenido: la barra
lateral cuando se abre encima en pantallas estrechas, la cabecera fija sobre lo
que se desplaza, y el aviso (*toast*).

**Caja de oración, no Title Case.** En español sólo llevan mayúscula la primera
palabra y los nombres propios. Ni mayúsculas forzadas por CSS: la única que
queda es la inicial del avatar, que es una letra sola.

**Lenguaje en Atkinson, medida en Plex Mono.** Todo lo que sea una cantidad va
en monoespaciada con cifras tabulares, para que las columnas se alineen solas.

---

## 2. Los tokens

Definidos en `style.css`, capa 12. **Nunca escribas un color literal**: si
necesitas un tono que no está aquí, es que falta un token o el diseño está
pidiendo algo que el sistema no quiere.

### Superficies

| Token | Oscuro | Claro | Para qué |
|---|---|---|---|
| `--ax-canvas` | `#191C21` | `#F7F6F3` | el lienzo, el fondo de todo |
| `--surf-2` | `#1E2228` | `#FFFFFF` | barra lateral, cabecera, barra de filtros |
| `--surf-1` | `#21252C` | `#FFFFFF` | tarjetas |
| `--surf-3` | `#2A2F38` | `#FFFFFF` | modales, desplegables, relleno de pastilla |
| `--ax-surface-hover` | `#333942` | `#F1EFEA` | la fila bajo el ratón |

En tema oscuro **la tarjeta es más clara que el lienzo**, no más oscura: se
lee como una hoja encima de la mesa. En tema claro el lienzo es papel
cálido-neutro y la tarjeta blanco puro, y esa diferencia es lo que separa una
de otra sin necesidad de sombra.

### Filetes y texto

| Token | Oscuro | Claro |
|---|---|---|
| `--ax-border` | `#3B424C` | `#D3CEC4` |
| `--ax-border-subtle` | `#2C323A` | `#E5E1D9` |
| `--ax-text-primary` | `#E9E7E2` | `#16202B` |
| `--ax-text-secondary` | `#9FA6B1` | `#5B6472` |
| `--ax-text-tertiary` | `#9AA2AD` | `#656D7A` |

Los filetes son **opacos, no transparencias**. Un `rgba` blanco al 5% da cuatro
grises distintos sobre cuatro superficies distintas —y sobre una tarjeta blanca
no da ninguno—. Ese fue el fallo que dejó las tablas sin separación de filas en
tema claro durante meses.

### Color con significado

| Token | Oscuro | Claro | Significa |
|---|---|---|---|
| `--ax-accent` | `#84B6E4` | `#1F4E79` | pulsable, activo, seleccionado |
| `--ax-on-accent` | `#16202B` | `#FFFFFF` | texto sobre acento relleno |
| `--ax-accent-emerald` | `#57C494` | `#14663F` | sube |
| `--ax-accent-rose` | `#F0768A` | `#A32A35` | baja |
| `--ax-accent-gold` | `#DFAC4C` | `#8A5A12` | atención, revisar |

`--ax-accent-sky`, `--ax-accent-purple` y `--ax-accent-coral` **siguen
existiendo y apuntan todos al acento**. No se borraron a propósito: así el
código antiguo que los use no se rompe, simplemente deja de tener un color
propio. No los uses en código nuevo.

### La escala de series

Seis pasos de una sola rampa, para gráficos:

```
oscuro  --serie-1 #E4EFF9  →  --serie-6 #2E5478   (de claro a oscuro)
claro   --serie-1 #0E3A5F  →  --serie-6 #C3DBEC   (de oscuro a claro)
```

Es una rampa y no seis matices sueltos porque **todo lo que pintan estos
gráficos va ordenado de mayor a menor**, y en una rampa el orden *es* el color.
Con matices arbitrarios ese orden se pierde, y además una porción verde del
anillo de canales se leía como «este canal va bien» cuando sólo decía «este
canal es el tercero». Se separaron a ΔE 13-15, medido, para que seis cosas
distintas se distingan.

Se usan desde JS con `serieColor(i)` y `serieColores(n)`.

### Tipografía y forma

```
--ax-font-sans   Atkinson Hyperlegible Next
--ax-font-mono   IBM Plex Mono
--ax-radius-sm   3px   controles
--ax-radius-md   4px   instrumentos
```

Dos radios y no doce. La pastilla (`999px`) sobrevive sólo donde la forma *es*
el dato: un avatar redondo, una píldora de estado.

---

## 3. Cómo está montada la hoja

`style.css` son **capas numeradas que se añaden al final del archivo**. Cada una
lleva un comentario con la medición que la motivó. Borrar una capa revierte
exactamente su decisión y nada más.

| Capas | Qué son |
|---|---|
| **1 – 11** | Historia. Paletas anteriores, correcciones sueltas. **No las extiendas.** Están ahí porque borrarlas rompería cosas que aún dependen de ellas. |
| **11.9** | El asesor de compras. Vivía en un `<style>` dentro de `index.html`; ver §4. |
| **12** | **Sistema Instrumento.** Los tokens, la tipografía, los radios, y la retirada de degradados, sombras de color y mayúsculas. Es el corazón. |
| 12.7 | La medida (las tres reglas graduadas del tablero). |
| **13** | Una sola tabla. Ritmo, densidades, cabeceras, cantidades en mono. |
| **14** | La escala de series. |
| 15 – 17 | El valor no lleva color · el filete de Mercado Público · las pastillas de Ficha Técnica. |
| **18** | La paleta de Prospección vuelve al sistema. |
| **19** | El bloque vacío, el podio, la fila del top de productos. |
| **20** | El velo blanco y las sombras. |
| **21** | El filtro del menú. |
| **22** | El terciario que la capa 12 no llegaba a aplicar (ver §4). |

**Para añadir algo nuevo: una capa nueva al final, numerada, con un comentario
que diga qué mediste.** No edites las capas 12 a 21 salvo para corregir un
error de esa misma capa.

---

## 4. Las trampas de este repositorio

Estas cuatro han costado tiempo real. Léelas antes de tocar nada.

### Los tres archivos son CRLF

`app.js`, `index.html` y `style.css` usan finales de línea Windows. Cualquier
script de Python que los parchee tiene que leer y escribir con `newline=''` y
unir con `\r\n`. **`sed -i` los convierte a LF en silencio**: después de un
`sed -i`, restaura con un round-trip de Python o el diff siguiente tocará el
archivo entero.

```bash
python -c "import io;P='app.js';s=io.open(P,encoding='utf-8',newline='').read();\
s=s.replace(chr(13)+chr(10),chr(10)).replace(chr(10),chr(13)+chr(10));\
io.open(P,'w',encoding='utf-8',newline='').write(s)"
```

### El orden del documento gana los empates

Hubo un bloque `<style>` en `index.html:41`, después del `<link>` a `style.css`
en la 37. Ganaba **todos** los empates de especificidad contra la hoja entera,
y por eso el asesor de compras se quedaba fuera de cada capa de diseño. Se movió
a la capa 11.9. **No vuelvas a meter un `<style>` en el HTML.**

Relacionado: muchas reglas se declaran bajo `[data-ax-theme="light"]` o
`[data-ax-theme="dark"]`, que es especificidad (0,2,0). Una clase suelta con
`!important` **no le gana**. Si una regla nueva tiene que pisar una de esas,
escríbela con el tema por delante:

```css
:root .mi-clase,
[data-ax-theme="light"] .mi-clase,
[data-ax-theme="dark"] .mi-clase { ... }
```

Y el caso que más despista, porque parece que la capa nueva gana y no gana:
**`:not()` suma la especificidad de su argumento.** La capa 8 declara

```css
:root:not([data-ax-theme="light"]) { --ax-text-tertiary: #8B95B9; }
```

que es (0,2,0). La capa 12 declara ese mismo token bajo `:root` y bajo
`[data-ax-theme="dark"]`, que son (0,1,0) cada uno: venir mil líneas después no
sirve de nada. El token se quedó cuatro capas con un valor que nadie había
elegido —y por debajo de 4,5:1 sobre las filas resaltadas— hasta que se midió.
La capa 22 lo corrige. **Si redefines un token de la capa 12, comprueba en el
navegador que el valor que llega es el que escribiste**:

```js
getComputedStyle(document.documentElement).getPropertyValue('--mi-token').trim()
```

### El canvas no entiende `var()` ni `color-mix()`

Chart.js resuelve los colores **una vez**, al construir el gráfico. Para lo que
pinta sobre canvas usa los ayudantes de `app.js`:

- `tokenColor('--ax-accent', respaldo)` → el token resuelto, en hex.
- `tokenAlfa('--ax-accent', 0.85)` → el mismo con alfa, en `rgba()`.
- `themeChartColors()` → `{tick, leyenda, rejilla, fondoTarjeta, fuente}`,
  cacheado por tema. **Todo el cromo de un gráfico sale de aquí**, resuelto al
  construirlo.

`refreshChartsTheme()` re-resuelve ejes, rejilla y leyenda al cambiar de tema,
pero **sólo se llama desde `toggleTheme()` y al arrancar**. Un gráfico que se
construye al entrar en una vista no lo alcanza nadie: por eso la leyenda de
Cotizaciones marcaba 1,48:1 en tema claro. De ahí la regla: el color sale del
tema *al construir*, no se corrige después.

### El punto decimal es de CSS, la coma es del usuario

`formatCLP()` y `formatPct()` escriben para el lector: `-$10.310`, `12,3%`.
Pero `style.left`, `style.width`, `setProperty('--glare-x', …)` y cualquier
porcentaje que acabe dentro de un atributo `style` son **CSS**, y CSS sólo
entiende el punto. Ahí se usa `toFixed()` a secas, con un comentario que lo
diga. Ya rompí uno una vez.

---

## 5. Los patrones que hay que respetar

### El estado vacío

Tres partes, en este orden: **qué pasa, por qué, y el botón que lo resuelve.**
Sin marco discontinuo alrededor: un recuadro de rayas dibuja el vacío como un
error, y la mayoría de las veces no lo es.

Y hay que distinguir **por qué** está vacío. No es lo mismo «los datos no han
cargado» que «tus filtros no dejan pasar nada»: en el primer caso mandar al
usuario a tocar filtros es mandarlo a perder el tiempo. Cuando es el filtro,
di **cuáles** están puestos y ofrece quitarlos de un clic. Ver `cotizVacio()`
en `app.js` y `precios-vacio` en la capa 11.

Cuando el mismo motivo afecta a varios bloques de una pantalla, la explicación
va **una vez** en el de arriba; los demás llevan una línea (`cotizVacioBreve`).

### Los distintivos

Un distintivo lleva **un dato o un estado que cambia**, nunca una etiqueta.
Había doce en el menú y diez repetían el título que tenían al lado («BI» en *BI
Analytics Studio*, «SKU» en *Productos & SKUs*). Un distintivo que repite su
título enseña al ojo a no mirar los distintivos, y con eso se pierden los que sí
dicen algo. Quedan dos: el número de filas cargadas y el canal de la sesión.

### Contraste

Todo texto llega a **4,5:1** contra el fondo compuesto, en los dos temas. Fondo
*compuesto*: si el elemento va sobre una superficie translúcida hay que componer
las capas antes de medir, o el número sale mal.

---

## 6. Cómo verificar

Estas son las comprobaciones que se corren de verdad después de cada cambio.
No son teoría: cada una nació de un fallo concreto.

```bash
node --check app.js                          # sintaxis
python -c "import io,re;print(len(re.findall(r'(?<!\r)\n', \
  io.open('app.js',encoding='utf-8',newline='').read())))"   # 0 = sigue CRLF
```

Llaves balanceadas en la hoja, y ni un color de la paleta retirada:

```bash
python -c "import io;s=io.open('style.css',encoding='utf-8',newline='').read();\
print(s.count('{'), s.count('}'))"
grep -c "rgba(61, 220, 151\|rgba(255, 196, 107\|rgba(77, 159, 236" app.js
```

En el navegador (`preview_start` con el nombre `glomax`), recorriendo las trece
vistas **en los dos temas**.

> **Antes de creerte una medición del navegador.** `getComputedStyle` justo
> después de `applyTheme()` devuelve valores del tema anterior, y los colores
> con transición devuelven el valor a medio camino. Un barrido que cambia de
> tema y mide seguido **miente**: en una sola sesión me dio «241 elementos bajo
> mínimo» y luego «170», y las dos veces eran cero. Espera un doble
> `requestAnimationFrame` más ~1 s después de cambiar de tema, y otro tanto
> después de cada `switchView`. Y cuando el barrido señale algo, **vuelve a
> medir ese elemento solo, ya asentado**, antes de tocar nada.
>
> La sonda tampoco sabe componer un `background-image`: si el elemento va sobre
> un degradado, salta el elemento en vez de dar un número inventado.

Con eso, lo que se comprueba:

- ningún elemento con fondo blanco translúcido sobre superficie clara;
- ninguna sombra negra fuera de barra lateral, cabecera y aviso;
- ningún `text-transform: uppercase` con texto (salvo el avatar);
- ningún porcentaje con punto en pantalla;
- ningún importe que empiece por `$-`;
- cero errores de consola y cero desborde horizontal.

**Y sube la versión de caché.** Aparece tres veces en `index.html` (la hoja,
`config.js` y `app.js`). Sin eso el navegador sirve lo viejo y pierdes media
hora persiguiendo un cambio que sí estaba aplicado.

---

## 7. Lo que se decidió no hacer

Anotado para que no se vuelva a proponer sin saber que ya se pensó.

**La plantilla de la cotización impresa** (`app.js`, ~7700-7840) mantiene su
paleta propia: es para papel blanco y ahí las reglas de pantalla no valen.

**Los valores de los `<select>`** siguen en Title Case (`value="Crédito 30
Días"`) aunque su etiqueta visible ya esté en caja de oración. Son el contrato
con la planilla: cambiarlos cambia lo que se escribe en la hoja, y eso es una
decisión de datos, no de diseño.

**Los nombres de columna** de la planilla (`colVal('Tipo Solicitud')`) tampoco
se tocan, por lo mismo.

**La rampa de aviso de Prospección** (`--prosp-fuga`, `--prosp-dormido`,
`--prosp-caida`, `--prosp-estable`) se quedó con sus tonos propios: es una
escala semántica de cuatro pasos que el sistema —que sólo distingue «mal» de
«atención»— no sabe representar, y sus tonos ya estaban medidos contra los dos
lienzos. Sí se alinearon los que compartían color con un acento retirado.

**La autenticación** es de cliente, con las contraseñas en `app.js` y en
atributos `data-pass` del HTML. Está señalado y es una decisión del dueño del
proyecto, no un descuido pendiente.
