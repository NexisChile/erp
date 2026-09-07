# TODOS

Hallazgos abiertos del panel BI de Glomax. Creado el 2026-09-01 por `/plan-eng-review`
sobre los commits `a718f2c..ccb3822` (módulo Prospección Canal Mayorista).

Las mediciones citadas se hicieron contra la caché real de 88.857 filas ese mismo día.
Si vuelves a medir y el número cambió, el hallazgo puede haber envejecido: vuelve a
comprobarlo antes de actuar.

## Prospección — modelo numérico

### El panel de metodología describe una fórmula que ya no existe

**What:** Corregir el texto de `app.js:13573` para que describa el percentil que el
código realmente usa, no la escala logarítmica que se eliminó.

**Why:** Ese panel es el argumento de auditabilidad del módulo — dice "mismos datos,
mismo resultado". Hoy afirma que el potencial se calcula con "venta de los últimos 12
meses en escala logarítmica". El código (`app.js:12790-12797`) usa un percentil sobre
`max(neto12m, anioPrevFull)`. Un panel que explica mal la fórmula es peor que no tenerlo.

**Context:** El cambio de log1p a percentil se hizo en una sesión anterior porque con
log1p un cliente de $105 mil sacaba 0,65 de potencial contra 1,00 de uno de $13 millones
y se colaba en la ruta. Se actualizó el código y el comentario interno, no el panel
visible. Verificado el 2026-09-01 leyendo ambas líneas.

**Effort:** S
**Priority:** P1
**Depends on:** Conviene hacerlo junto con el rediseño del score (T1), que cambia otra
vez la fórmula. Hacerlo antes sería escribir dos veces.

### El conteo de clientes de una región no cuadra con su lista

**What:** Unificar el criterio de "cliente activo" entre `app.js:12732`
(`R.clientesAct.add(clave)`, por fila) y `app.js:12779` (`R.clientes`, por cliente).

**Why:** La tabla dice un número y la lista de abajo tiene otro. Medido el 2026-09-01:
Metropolitana muestra 65 clientes activos y solo 64 de su lista tienen `ytd > 0`;
Coquimbo 8 contra 7; Sin región 13 contra 12.

**Context:** La causa son las notas de crédito. Un cliente cuya única actividad del año
es una devolución transacciona (entra en `clientesAct`) pero su neto es negativo, así que
la segmentación lo trata como caído. Caso concreto: un cliente cuyo `ytd` es -$77.340 aparece
segmentado como **"Nuevo"**. Otro, con -$130.900, cuenta como activo en Coquimbo y como
DORMIDO en la lista. (Nombres omitidos a proposito: este archivo se publica.)

Efecto latente relacionado: `penetracion` (`app.js:12775`) toma el numerador del conteo
por fila y el denominador del conteo por cliente, así que puede pasar de 1,0 e imprimir
"más del 100% de la región lo compra". Hoy da 0 casos porque ningún cliente tiene ventas
reales en dos regiones; un mayorista con sucursales lo rompe.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Las sugerencias de reposición no tienen techo

**What:** Poner un límite superior en `app.js:12989` (`sin <= mediana * 1.3` no tiene
cota máxima) y aplicar a `C.skus` la misma ventana de 24 meses que `R.skus` ya usa en
`app.js:12735`.

**Why:** De las 252 sugerencias de reposición que el modelo produce hoy, 184 (73%) son
para SKU que el cliente no compra hace más de un año. La mediana de días desde la última
compra de ese SKU es 613 y el p90 es 1.153.

**Context:** Una sugerencia dice literalmente "repone cada ~9d, lleva 1300d". Eso no es
un pedido atrasado, es una línea descontinuada. El vendedor que la lea pierde
credibilidad delante del cliente. Medición del subagente de revisión, 2026-09-01.

**Effort:** S
**Priority:** P2
**Depends on:** None

### El valor de reposición divide por líneas de factura, no por compras

**What:** Deduplicar `S.compras` por día antes de usarlo en `app.js:12995`
(`valor: (S.neto / S.compras.length) * 1.6`).

**Why:** `S.compras` recibe una entrada por línea de factura (`app.js:12729`), no por
pedido. Un SKU que se despacha en cinco líneas por pedido ve su valor por compra dividido
entre cinco, y queda por debajo de un SKU que vale la quinta parte.

**Context:** El autor ya sabía que existen duplicados del mismo día: la mediana de
cadencia justo debajo los filtra con `huecos.filter(h => h > 0)`. La corrección se aplicó
a la cadencia y no al valor.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Con MTD negativo la banda de proyección sale invertida

**What:** Guardar el signo en `app.js:12833-12834` antes de dividir por las cuotas.

**Why:** Con `R.mtd < 0`, dividir por la cuota mayor da el número mayor, así que
`proyMesMin > proyMesMax` y el KPI imprime el rango al revés. Además la proyección se
amplifica: -$1M dividido por una cuota de 0,03 proyecta una devolución de $33M.

**Context:** Latente hoy — ninguna región va negativa en lo que va del mes. Pero el canal
arrastra 331 líneas de nota de crédito por -$50,0M, y una región chica en los primeros
días del mes está a una devolución de caer ahí.

**Effort:** S
**Priority:** P2
**Depends on:** None

### ~~El respaldo de comuna es el literal 'Santiago'~~ RESUELTO 2026-09-04

**What:** Cambiar `app.js:269` (`const comuna = norm['COMUNA'] || 'Santiago';`) por un
centinela que el módulo pueda detectar, como ya hace `prospRegionDe` con
'Región Metropolitana'.

**Why:** La comuna decide por dónde maneja físicamente un vendedor. El módulo escribió
quince líneas de defensa contra el caso gemelo en Región y ninguna para Comuna: las
comunas en blanco llegan como el literal 'Santiago' y votan en `D.comunas` con peso
`|NETO| + 1`, o sea con los pesos más grandes del mapa.

**Context:** Hoy no desplaza a nadie por una coincidencia del ERP: Región y Comuna vienen
en blanco exactamente en las mismas 1.028 líneas, así que el `if (reg.clave === 'SR')
return;` escuda el voto de comuna sin proponérselo. Si esas columnas se independizaran,
el mayor cliente del canal se movería a "Santiago" (peso 40,3M en blanco contra 27,2M de
su comuna real).
Es una garantía de corrección apoyada en una casualidad. El `|| 'Sin comuna'` de
`app.js:12586` es código muerto por la misma razón.

**Effort:** S
**Priority:** P2
**Depends on:** None

**Resuelto el 2026-09-04.** No con un centinela sino quitando el invento: `normalizeDataRows` ya no rellena ni la comuna ni la region, asi que vacio llega
vacio y el modulo no tiene que adivinar cual de los dos es. La garantia apoyada en
una casualidad -que Region y Comuna vinieran en blanco en las mismas lineas- deja
de hacer falta.

### 92 clientes en cero comprimen el eje de potencial

**What:** Calcular el percentil de `app.js:12797` sobre la población con `tamano > 0`.

**Why:** 92 de 291 clientes tienen `tamano === 0` y todos caen en la posición 0, así que
el percentil de cualquier cliente real arranca en 0,317. El factor potencial, que pesa
30%, solo puede separar a dos clientes vivos por 20 puntos, mientras recencia sola mueve 25.

**Context:** Es parte de por qué el score ordena mal (ver T1). Arreglar el score sin esto
deja media palanca sin usar.

**Effort:** S
**Priority:** P2
**Depends on:** Hacerlo junto con el rediseño del score (T1).

## Prospección — presentación y export

### "Sin región asignada" imprime +5210% y entra en los totales

**What:** Decidir si la pseudo-región entra en el TOTAL CANAL, en `T.proyAnio` y en el
Excel, o si solo se muestra aparte como diagnóstico.

**Why:** Se excluye de la secuencia geográfica de la cinta pero sí entra en la tabla de
regiones, en el pie TOTAL CANAL, en la proyección anual y en la exportación. Como casi no
tiene historia de 2025 (el ERP escribió Región hasta julio de 2026), imprime un delta de
cierre de **+5210%**. Antofagasta imprime +717%.

**Context:** `prospPctBarra` satura la barra, pero el número viaja tal cual al Excel y al
total. Un porcentaje de cuatro dígitos en un informe hace dudar de todo el resto.

**Effort:** M
**Priority:** P2
**Depends on:** Pierde importancia si se arregla la columna Región en el ERP.

### El Excel exporta una hoja filtrada y otra sin filtrar

**What:** Unificar el criterio de alcance entre las hojas de `exportarProspeccionExcel`.

**Why:** La hoja "Ruta" respeta región y segmento
(`prospArmarRuta(R, prospDiasRuta, prospVisitasDia, prospSegmentoSel)`), y la hoja
"Cartera" exporta `M.clientes` completo — los 291 — ignorando `prospRegionSel`,
`prospSegmentoSel` y `prospBusqueda`. Mismo botón, mismo libro, dos reglas distintas, sin
nada que lo indique.

**Context:** Quien filtre por una región y exporte va a creer que la hoja Cartera es de
esa región. La seguridad del nombre de hoja sí está bien: `xlsxNombreHoja`
(`app.js:10524`) sanea y trunca, así que los nombres de región truncados a 40 caracteres
de la rama `'OTRA:'` no pueden corromper el archivo.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Datos — origen

### El ERP dejó de escribir la columna Región

**What:** Arreglar en el origen la columna Región de las líneas mayoristas.

**Why:** Desde julio de 2026 llega vacía en el **100%** de las filas. Medido el
2026-09-01: julio 390 de 390, agosto 423 de 423, septiembre 18 de 18. Son 833 filas y
$103.180.942, el **29,4% de la venta mayorista del año**, repartida por el historial del
cliente en vez de por el dato. Crece unos $45M al mes.

**Context:** El módulo imputa la región desde el domicilio comercial dominante del cliente
y lo avisa en pantalla, así que el panel no miente. Pero mientras la imputación funcione,
nadie siente la presión de arreglar el origen, y cada mes que pasa hay más plata
atribuida por inferencia. Esto no se arregla en este repositorio: es configuración del
ERP o de la planilla que lo alimenta.

**Actualizado el 2026-09-04.** Sigue abierto. Dos cosas nuevas:

1. El dueno del proyecto encontro y corrigio un error de formula en la planilla.
   Medido ese mismo dia contra la cache recien bajada, el sintoma no ha cambiado:
   de las 186.279 filas del origen, 41.754 traen region (22,4%). Conviene
   comprobar si la correccion llego a esta pestana o si la hoja no ha
   recalculado.

2. Medido sobre TODA la planilla y no solo el canal mayorista, el problema es mas
   viejo de lo que decia este hallazgo: la region nunca ha llegado en mas de un
   tercio de las lineas -entre 32% y 45% por mes desde 2023-. Julio de 2026 al 4%
   fue una averia puntual encima de una cobertura que ya era mala.

Lo que si cambio es que ahora **se ve**: la aplicacion dejaba de inventar
'Region Metropolitana' para las filas vacias, que ponia $2.059 millones -el 30,4%
de la facturacion- bajo una region sin respaldo. El KPI de Top region dice ahora
que parte de la venta trae direccion.

**Effort:** M
**Priority:** P1
**Depends on:** Fuera de este repo.

## Diseño

Agregado el 2026-09-01 por `/plan-design-review` sobre el módulo de Prospección.
Puntaje inicial 6/10, final 8/10. Las tildes se arreglaron en la misma sesión.

### No existe DESIGN.md

**What:** Generar un sistema de diseño escrito para el panel, con `/design-consultation`
o a mano.

**Why:** Sin él cada decisión visual se relitiga desde cero. En esta sola revisión
tuvimos que decidir de nuevo el peso relativo de los KPI, cuándo una tarjeta se justifica
y qué radio usar. Con un documento, esas respuestas ya estarían dadas.

**Context:** El panel ya tiene un sistema de facto bastante coherente: variables CSS por
tema, Inter Tight en títulos, Inter en cuerpo, JetBrains Mono en cifras, radio de 16 px,
un acento por estado. Lo que falta no es inventarlo, es escribirlo. Ojo con un detalle:
gstack marca Inter como "stack por defecto" en su lista de slop; aquí no aplica, las tres
tipografías son una elección deliberada y conviene dejarlo dicho en el documento para que
la próxima revisión no lo marque otra vez.

**Effort:** M
**Priority:** P2
**Depends on:** None

### La ruta no recuerda a quién ya visitaste

**What:** Guardar por cliente la marca de visitado con su fecha, y que
`prospArmarRuta` los baje o los excluya.

**Why:** El módulo produce un plan de tres días pero no tiene memoria: el martes muestra
la misma ruta del lunes, con los mismos clientes, incluidos los que el vendedor ya visitó.
Un plan de varios días que no recuerda los días anteriores no es un plan.

**Context:** Diferido a propósito en esta revisión: se eligió recordar solo los filtros
(región, segmento, días, visitas) en localStorage, que era el arreglo barato. Marcar
visitas es estado por cliente y abre preguntas que hay que responder antes: qué pasa al
cambiar de navegador o de equipo, cuánto dura la marca, si un gerente ve las visitas de
su vendedor. Conviene hacerlo después de corregir el puntaje de prioridad (T1), porque
hasta entonces la ruta apunta al lugar equivocado y recordarla no sirve de nada.

**Effort:** L
**Priority:** P2
**Depends on:** T1 (rehacer el puntaje de prioridad).

## Acceso

Medido el 2026-09-07 sobre la aplicacion desplegada. Lo que se arreglo en el commit
del acceso esta marcado RESUELTO; lo que queda abierto necesita una decision tuya o
tocar Apps Script.

### El acceso no protege los datos

**What:** Que Apps Script valide usuario y contrasena, devuelva un token firmado con
caducidad, y que el endpoint de datos deje de responder sin ese token.

**Why:** Medido: **89.223 filas ya estan en memoria antes de escribir nada** en la
pantalla de acceso. Y `config.js` publica `API_URL` y `SPREADSHEET_ID` en claro, asi que
la planilla entera se baja con un `curl` desde la URL de GitHub Pages sin ver nunca esa
pantalla. El acceso decide que canal ves; no impide que nadie vea nada.

**Context:** Es la unica de las cinco cosas que se midieron y no se puede arreglar solo
desde el navegador: el cliente no puede guardar un secreto. Exige `Code.gs`, las Script
Properties y un redespliegue de la aplicacion web. Mientras no exista, la pantalla ya no
promete lo que no cumple: dice "identificate para ver el tablero de tu canal".

**Effort:** L
**Priority:** P1
**Depends on:** None

### Las contrasenas actuales son publicas y hay que cambiarlas

**What:** Elegir contrasenas nuevas para las cuatro cuentas. Los hashes se regeneran en
un minuto (`SHA-256` de `correo:contrasena`, ver `authHash` en `app.js`).

**Why:** `123456`, `admin123` y `123456` estuvieron en `app.js` y en `data-pass` del
HTML, servidos publicamente por GitHub Pages, desde el primer despliegue. Ya no estan,
pero **quien las haya leido las tiene**, y el historial de git tambien. Quitarlas del
codigo no las revoca: solo cambiarlas lo hace.

**Context:** Conviene hacerlo aunque se vaya a por la cerradura de verdad, porque hasta
entonces son lo unico que separa a un curioso del tablero.

**Effort:** S
**Priority:** P1
**Depends on:** None

### El canal de retail@glomax.cl no existe en la planilla

**What:** Decidir a que canal real corresponde `retail@glomax.cl` y escribirlo en
`AuthManager.accounts`, o retirar la cuenta.

**Why:** La cuenta dice `Retail` y la planilla escribe `ECOMMERCE, MARKETPLACE,
MAYORISTAS, PRIVADOS, PUBLICO, TIENDA FISICA`. No hay ninguno equivalente. Hasta que se
decida, esa cuenta ve todos los canales y el filtro lo dice en su titulo en vez de
fingir que restringe.

**Context:** `Publico` y `Mayorista` si resuelven (a `PUBLICO` y `MAYORISTAS`) porque la
comparacion ignora tildes, mayusculas y la S final. `Retail` no es una variante de
nada: es otro nombre. No se eligio uno por ti a proposito; adivinarlo seria repetir el
error de la region inventada.

**Effort:** S
**Priority:** P1
**Depends on:** Que digas cual es.

### ~~El candado de canal mostraba todo diciendo que restringia~~ RESUELTO 2026-09-07

**What:** `applyUserChannelPermissions` buscaba el canal de la cuenta entre las opciones
reales, no lo encontraba, inventaba una opcion, y `populateFilterOptions()` -la linea
siguiente de `login()`- la borraba con su `innerHTML=`.

**Why:** El filtro quedaba deshabilitado, pintado de bloqueado y con el titulo "Acceso
restringido unicamente al canal Retail", **mostrando los seis canales**. Un vendedor veia
la facturacion completa creyendo que veia la suya.

**Context:** Arreglado en tres partes: la comparacion normaliza tildes, mayusculas y
plural; el candado se aplica DENTRO de `populateFilterOptions` para que sobreviva a la
recarga de datos de cada 120 s; y cuando el canal no resuelve, el filtro se queda abierto
y lo dice. Verificado: `mayorista@glomax.cl` ve 14.912 de 89.375 filas.

**Effort:** M
**Priority:** ~~P1~~
**Depends on:** None

### ~~La pantalla de acceso se cortaba en telefono~~ RESUELTO 2026-09-07

**What:** A 375x667 la tarjeta media 725px y se cortaba 29px arriba y 29px abajo, sin
forma de desplazarse. Los campos iban a 12,25px, bajo el umbral de 16px que hace que
Safari en iOS haga zoom al enfocar.

**Why:** Un iPhone SE es comun en Chile y el logo y la ultima fila quedaban fuera.

**Context:** Capa 25 de `style.css`. El velo pasa a `overflow-y:auto` con
`align-items:flex-start` y `margin:auto` en la tarjeta, que centra mientras cabe y
desplaza cuando no. Los 16px van en pixeles y no en `rem` porque este documento declara
`html{font-size:14px}`: escrito como `1rem` la regla se aplicaba y no cruzaba el umbral.
Medido despues: tarjeta de 481px, nada cortado, campos a 16px.

**Effort:** M
**Priority:** ~~P2~~
**Depends on:** None

## Navegación

### Marketplace, Ecommerce y Tienda física solo tienen Dashboard

**What:** Decidir qué otras vistas cuelgan de cada módulo de canal. Hoy cada uno
tiene un único hijo, que es el tablero principal con su canal aplicado.

**Why:** Un acordeón con un solo hijo es un botón con un paso de más. Se aceptó
así a propósito -es andamiaje, y el patrón ya está montado para colgarle más- pero
si en un mes siguen con un hijo cada uno, conviene aplanarlos a botones directos.

**Context:** Mayoristas ya tiene dos (Dashboard y Prospección) y Mercado Público
tres, así que el acordeón se gana su sitio en esos dos. Los otros tres no todavía.

**Effort:** S
**Priority:** P3
**Depends on:** Que definas qué vistas por canal hacen falta.

### PRIVADOS y PUBLICO no tienen módulo

**What:** Decidir si los otros dos canales de la planilla merecen módulo propio.

**Why:** `CANAL FINAL` trae seis valores. Cuatro tienen módulo; `PRIVADOS` (4.413
filas) y `PUBLICO` (5.927) no. Se llega a ellos por el filtro rápido "Canal final",
que sigue en la barra, pero no por la sección Canales, lo que la hace parecer
completa sin serlo.

**Context:** `PUBLICO` es delicado: el módulo Mercado Público NO lee ese canal, lee
su propia pestaña. Llamar "Público" a un quinto módulo de canal al lado de "Mercado
Público" sería confundir dos cosas distintas.

**Effort:** S
**Priority:** P3
**Depends on:** None

### ~~BI Analytics Studio~~ ELIMINADO 2026-09-07

**What:** Se retiró el módulo entero: el marcado, las cuatro funciones que lo
pintaban y el enganche de sus deslizadores.

**Why:** Pedido. Se fueron con él cuatro cosas que no viven en ningún otro sitio:
el resumen ejecutivo, el simulador "What-If", el Pareto 80/20 y la matriz RFM de
segmentación de cartera.

**Context:** Si alguna hace falta, está en el historial de git (commit anterior a
este) y se puede recolocar en otro módulo sin rehacerla.
`renderMonthlyTargetProgress` se quedó: estaba en la lista de render de esa vista
pero también pinta el avance de la meta en el tablero.

**Effort:** ~~M~~
**Priority:** ~~—~~
**Depends on:** None
