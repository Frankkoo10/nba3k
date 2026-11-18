# Basket 3D — v61

Basket en tercera persona con Three.js: cancha NBA a escala real, física realista, menú con los 30 equipos (con escudos), marcador estilo NBA TV, tribuna estilo Chase Center (Warriors), árbitro y un rival (bot) quieto.

## Ejecutarlo
1. Descomprimí el ZIP y abrí la carpeta en VS Code.
2. En la terminal: `npx serve .`
3. Abrí la dirección local (hace falta internet para Three.js y la tipografía).

## Controles
- **W A S D** moverte · **Shift** correr · **Espacio** saltar
- **Cerca del aro, mirando hacia él, con Espacio:** corriendo rápido = **mate** (dos variantes), más lento = **bandeja**
- **Mouse** cámara (clic en la cancha para activarlo) · **Rueda** zoom
- **C** cámara de TV (alta, con teleobjetivo, panea y hace zoom siguiendo la jugada; con ella W va hacia el fondo de la pantalla y A/D de lado a lado)
- **Mantener clic** cargar el tiro y **soltar** en la línea blanca para tiro perfecto
- **R** reiniciar posesión al instante (modo práctica) · botón **Equipos** vuelve al menú

## Novedades v3
- **Escudos** de los 30 equipos (carpeta `logos/`, recortados de `nba.jpg`) en el menú, en el marcador y en el tablero del estadio.
- **Tribuna estilo Chase Center:** bowl inferior y superior empinados, paredes de suites con luz cálida, butacas azules con franjas doradas, público con camisetas azules, doradas y blancas que salta cuando hacés un punto, pantallas LED en la banda y alrededor del bowl, tablero gigante colgado del centro, banners de campeonatos de los Warriors, techo de madera, mesa de anotadores y logo de los Warriors en el centro de la cancha. Todo está en `arena.js`.
- **Cámara de TV** (tecla C), ver arriba.
- **Reglas de pelota muerta:**
  - Si la pelota pica afuera de las líneas, o vos pisás afuera con la pelota en la mano, es *fuera de límites*.
  - Si se acaban los 24 s, es violación.
  - Pasa lo mismo al empezar cada cuarto.
  - Después de un doble, triple o mate hay saque de fondo del lado contrario.
- **Reinicio realista:** silbato, la jugada se congela un instante, corte a negro, y el **árbitro** te entrega la pelota en el lugar del saque (lateral más cercano, fondo, o mitad de cancha junto a la mesa). El reloj arranca recién cuando te entrega la pelota, y no podés tirar hasta entrar a la cancha.

Para agregar más banners de campeonato, editá el arreglo de años en `arena.js` (busca `1947`).

## Novedades v4
- **Menú principal** estilo NBA Courtside 26 (imagen en `assets/menu-hero.jpg`): Partido casual, Entrenamiento, Carrera Jugador y DT (próximamente) y Configuración. Se navega con mouse o con ↑ ↓ + Enter.
- **Entrenamiento:** jugador con remera blanca, sin rival, sin árbitro y sin reloj. Si la pelota se va afuera vuelve a tus manos. Panel con anotados, tiros, efectividad, racha y XP. **Esc** pausa (desde ahí volvés al menú).
- **Partido casual:** el partido de siempre (elegís equipos, marcador, 24 s, cuartos).
- **Cuentas con Supabase:** login / registro. Configurá `config.js` y corré `supabase/001_perfiles.sql` en el SQL Editor. Sin configurar, aparece "Continuar sin cuenta (solo pruebas)".
- **Nivel y XP:** cada canasta en entrenamiento suma XP (se guarda en Supabase con la función `add_xp`).
- **Árbitro:** en los saques ahora se para adelante y a la derecha del jugador, para que la cámara no lo tape.

## Novedades v5 — 5 contra 5 con IA
- **Partido casual 5v5**: cada equipo tiene 5 en cancha (PG, SG, SF, PF, C) con nombre, número, altura y ratings. Controlás al que tiene la pelota; en defensa, al más cercano (**Q** para cambiar a mano).
- **Dificultad: Fácil / Difícil / Extremo** (menú del partido). Cambia velocidad, reacción, puntería, presión defensiva, robos, tapones e intercepciones del rival. Tus compañeros bots juegan igual en todas las dificultades. Se guarda en el navegador.
- **IA de los bots** (`ai.js`): con la pelota tiran si están libres, pasan al mejor ubicado, penetran, hacen cruces, bandejas y mates; sin la pelota se abren a sus puestos y cortan al aro; en defensa marcan hombre a hombre del lado del aro, ayudan cuando hay penetración, roban, saltan a taponar y pelean los rebotes. Fallan o encestan según la calidad real del tiro (distancia, marca, cansancio y rating).
- **Controles nuevos**: **E** o clic derecho = pase (flecha verde sobre el receptor; te pasa el control) · **Ctrl** o **V** = dribleo/cruce (mantenelo para dribleo veloz; gasta energía y, **cansado, no se puede**) · **F** = robar · **Espacio** en defensa = taponar · **Q** = cambiar jugador · **C** = cámara.
- **Cansancio**: barra de energía abajo a la izquierda. Correr y driblear gasta; cansado van más lento y no pueden hacer cruces. En las pausas entran los **suplentes** por los más cansados.
- **Cámaras (C)**: **2K** (la más usada de NBA 2K: alta, detrás del jugador mirando al aro, se abre para meter a los jugadores cercanos), **TV** (hace zoom y panea para que entren todos) y **libre** (mouse). El partido arranca en 2K; el entrenamiento en libre.
- **Reglas**: posesión alternada en los cuartos, cambio de lado en el entretiempo, triples (arco y esquinas), tiempo suplementario si hay empate, 24 s que se frena en rebotes, saques del equipo que corresponde.
- **Planteles en Supabase**: corré `supabase/002_equipos_jugadores.sql`. Crea `teams` (los 30) y `players` (titulares/suplentes, posición, número, ratings). Cargás jugadores desde Table Editor y el juego los lee solo. Si falta alguien, se completa con genéricos (marcados con `*` en el menú).
- **Arreglo del menú**: ahora podés escribir cualquier letra (W, A, S, D, espacio…) en email/contraseña; el juego ignora el teclado mientras escribís.
- **Ojo con Ctrl+W**: el navegador cierra la pestaña con Ctrl+W y no se puede bloquear. Usá **V** para driblear mientras corrés con W, o activá *Configuración → Pantalla completa* (bloquea esas teclas). El juego también avisa antes de cerrar en medio de un partido.


## Uniforme Lakers (prueba v5)
- Al elegir Los Angeles Lakers, los jugadores usan camiseta y short dorados con vivos violeta/blanco y laterales coordinados.
- El frente muestra `LAKERS` y el número; la espalda muestra apellido y número.
- Apellido y número se dibujan desde `players.name` y `players.number` de Supabase cada vez que se asigna un jugador, incluidos los cambios desde el banco. No quedan fijados en el modelo.
- Los demás equipos conservan su uniforme básico por colores; esta primera pasada de detalles está preparada solo para LAL.


## Novedades v8 — jugadores con cuerpo de persona real
- **Cuerpos nuevos** (`rig.js` + `rig-geo.js`): ya no son cápsulas ni cajas. Cada parte se arma con perfiles elípticos que forman los músculos: deltoides, bíceps, antebrazo, pecho en V con cintura, cuádriceps, rodilla, gemelos, tobillo, cuello y trapecios. Short con piernas que acompañan cada paso, medias y zapatillas con suela, caña y puntera.
- **Cara inventada y medio borrosa** (estilo PS2): cráneo con mandíbula, mentón, cejas, nariz, pómulos y labios; ojos y cejas pintados a baja resolución. Peinados (corto, rapado, afro, high top, pelado) y barba (ninguna, sombra, completa) que salen del nombre del jugador, siempre iguales para el mismo jugador.
- **Contextura por posición**: bases más flacos, pívots más anchos (`BUILD` en `main.js`). La altura sigue saliendo de `height_cm`.
- **Movimiento más real**: la pelvis y los hombros giran en sentidos opuestos al correr, la cadera se inclina, la cabeza se mantiene estable y mira al aro (con la pelota) o a la pelota (sin ella). Los pies se apoyan planos en el piso, levantan los talones al empujar y apuntan las puntas en el aire. La cadera sube y baja justo lo necesario para que el punto más bajo del pie toque el piso (sin flotar ni hundirse). Los hombros se encogen al levantar los brazos y el pecho respira.
- **Árbitro** con mangas cortas y pelo canoso.
- Las medidas de los huesos y de las manos no cambiaron, así que la pelota, los mates, los pases y la IA se comportan igual.
- Uniforme de los Lakers: los decals (número y nombre) ahora se curvan sobre la camiseta, y las franjas laterales y el dobladillo del short siguen la forma del cuerpo.


## Novedades v9 — dribleo pegado al cuerpo + atributos estilo NBA 2K26
- **La pelota ya no se despega al correr** (`main.js`, `dribbleControl` y `pose`):
  - Antes el objetivo de la pelota sumaba `velocidad × 0.16`, así que a velocidad de sprint rebotaba a ~1.5 m del cuerpo, fuera del alcance del brazo. Ahora la distancia crece suave con la velocidad pero con **tope de 0.62 m** (dentro del alcance) y la corrección hacia la mano es más fuerte (menos retraso al frenar o girar).
  - **El brazo que dribla apunta a la pelota real** (cinemática inversa de 2 huesos): hombro y codo se acomodan según dónde está la pelota, en vez de usar una pose fija.
- **Atributos de cada jugador como en 2K26** (`supabase/003_atributos_2k.sql`, corrélo después del 002): tiro cercano, media distancia, triple, tiros libres, bandeja, mate en movimiento, mate parado, juego de poste, precisión de pase, manejo de balón, velocidad con balón, defensa interior, defensa perimetral, robos, tapones, rebote ofensivo y defensivo, velocidad, fuerza, salto y resistencia (escala 25–99).
- **Altura en pulgadas** (`height_in`, ej. 74 = 6'2") y **peso en libras** (`weight_lb`), más `wingspan_in` (envergadura). `height_cm` se calcula solo.
- Vistas nuevas: `plantel` (con todo) y `equipos_resumen` (promedios de los 5 titulares por equipo).
- **En el juego**: los tiros usan el rating de la zona (cerca del aro, media o triple), los cruces y robos usan manejo de balón vs defensa perimetral / robos, la precisión del pase usa `pass_accuracy`, la bandeja usa `driving_layup` y la velocidad con pelota usa `speed_with_ball`. La contextura del cuerpo sale del **peso y la altura** (IMC) y la escala del modelo, de la altura.
- **Menú**: cada jugador muestra altura y peso con su OVR, cada equipo su OVR, y al tocar un nombre se abre su **ficha** con todas las barras. Si a un jugador le faltan atributos, se estiman desde su OVR y su posición (y la ficha lo avisa).
- Compatibilidad: las columnas viejas (`shooting`, `passing`, `defense`, `rebound`) siguen funcionando si no cargás los atributos nuevos.
- Arreglo: un campo vacío en Supabase (null) ahora cuenta como "sin dato" y usa el OVR; antes quedaba en 30.


## Novedades v10 — menú previo al partido (estilo FC / 2K)
Al elegir **Partido casual** ya no se entra directo a elegir equipos: se abre un asistente de 5 pasos (`prematch.js`). Se navega con el mouse o con **Enter** (siguiente) y **Esc** (volver); arriba están los 5 pasos y podés saltar a cualquiera. Todo lo que elegís se guarda en el navegador para la próxima vez.

1. **Jugadores**: 1 jugador (teclado y mouse). 2, 3 y 4 jugadores aparecen como *Próximamente*: van a llegar con el soporte de joystick. El menú ya detecta si hay un joystick conectado y te lo avisa (todavía no se puede jugar con él).
2. **Equipos**: los 30 equipos con escudo, los 5 titulares con altura, peso y OVR, y la ficha estilo 2K de cada jugador. Botón *Intercambiar* para cambiar de lado.
3. **Camisetas** (`kits.js`): cada equipo tiene 4 — **Icon** (color principal), **Association** (blanca), **Statement** (color secundario u oscuro) y **City** (oscura con vivos). Se ven en una vista previa con el apodo y el número. Si las dos camisetas se parecen, el menú avisa y ofrece elegir la mejor para el rival (si cambiás la tuya, la del rival se ajusta sola). Los Lakers conservan su Icon Edition dorada.
4. **Tu equipo**: cambiá los titulares (tocá un titular y después *Entra* en un suplente), elegí con quién arrancás (★) y el **estilo de juego** de tus compañeros bots: *Ritmo* (lento/normal/rápido), *Tiro* (equilibrado/triples/cerca del aro), *Juego* (individual/equilibrado/colectivo) y *Defensa* (suelta/normal/presión). El estilo cambia solo a tu equipo (`styledProfile` en `ai.js`).
5. **Partido**: dificultad, duración del cuarto (1, 2, 3, 5 u 8 min), reloj de 24 s (sí/no), cansancio (sí/no), cambios automáticos (sí/no) y cámara inicial (2K/TV/libre), con un resumen del cruce. **¡JUGAR!** empieza el partido.

Al terminar el partido, el asistente vuelve a abrirse en el último paso con el resultado, para jugar la revancha con la misma configuración.

### Otros cambios
- **Todas las camisetas** ahora llevan franjas laterales, apodo del equipo al frente y nombre y número atrás (antes solo los Lakers). Los colores de los textos se eligen solos para que se lean (`rig.js` + `kits.js`).
- En el entrenamiento el jugador vuelve a la remera blanca lisa, sin nombre ni número.
- Se sacó el menú de equipos anterior de `index.html` y de `main.js`; la lógica de equipos, planteles y fichas ahora vive en `prematch.js`.
- Archivos nuevos: `prematch.js` (asistente) y `kits.js` (camisetas).

## v11 · Menú previo estilo FC / 2K
- Rediseño completo del asistente de "Partido casual" (prematch.js + style.css), con los colores del juego (azul noche + dorado).
- **Equipos**: panel Local vs Visitante con logo grande, notas GRL / ATA / DEF, selector ‹ › (flechas del teclado, Tab = cambiar lado, R = al azar) y grilla de los 30 equipos al tocar el logo.
- **Camisetas**: dos jugadores 3D reales (los mejores de cada plantel) con la camiseta elegida; 4 uniformes a cada lado.
- **Tu equipo**: quinteto de 5 sobre la cancha en perspectiva, nombre/posición/OVR de cada uno, ★ = con quién arrancás, ⓘ = ficha. Menú de Ritmo / Tiro / Juego / Defensa y banco para hacer cambios.
- Nuevos archivos: `stage.js` (escenario 3D), `stagecam.js` (cámara compartida). Si WebGL falla, el menú muestra camisetas planas y sigue funcionando.
- `main.js`: no dibuja la cancha de fondo mientras el menú está abierto (menos carga de GPU).

### Secuencia de tiros libres
Cuando una falta lleva a tiros libres, el juego ahora pausa la acción y presenta una secuencia completa: los diez jugadores se acomodan en la línea y los espacios de rebote, la cámara encuadra al lanzador, el jugador ejecuta la animación de tiro, la pelota vuela hacia el aro y se actualiza el marcador según su atributo de tiros libres. Se repite por cada lanzamiento y luego el rival repone desde el fondo.


## Novedades v14 — faltas y tiros libres
- **Tiros libres con habilidad:** tras el silbato nadie se teletransporta: los jugadores trotan a sus lugares de la zona, el árbitro agarra la pelota, camina a la línea y **te la entrega**. Después **el tiro lo hacés vos** (mantené el clic y soltá en la línea blanca). Los bots tiran según su rating de libres.
- **Último libre errado = pelota viva** (rebote). Último libre convertido = saque de fondo del rival.
- **Cada falta tiene su consecuencia:**
  - Falta sobre un tiro de 2 → 2 libres · sobre un triple → 3 libres · canasta + falta → **y uno** (canasta + 1 libre).
  - Falta común sin bonus → **saque de banda**. Con bonus (5.ª falta del equipo en el cuarto) → 2 libres.
  - **Técnica** (insistir de más con el robo, protestar con 5+ faltas, colgarse del aro tras un mate) → 1 libre del rival y la pelota sigue siendo de quien la tenía.
  - **Falta en ataque** (llevarte puesto a un defensor parado) → pérdida y saque de banda del rival.
- Las faltas personales se cuentan por jugador (`info.pf`). Todo está en `main.js` (buscá `commitFoul` y `updateFT`).

## Novedades v15 — joystick
- **Anda con cualquier joystick** que el navegador reconozca (Xbox, PlayStation DualShock/DualSense, Switch Pro y la mayoría de los genéricos). Apretá un botón para que lo detecte. Mismos botones que NBA 2K (nombres PlayStation / Xbox):
  - **Stick izquierdo**: moverte (la inclinación = velocidad) · **Stick derecho**: cámara libre · **Cruceta ↑↓**: zoom
  - **□ / X**: tirar (mantené y soltá en la línea blanca). Sin la pelota: saltar / taponar / rebote
  - **✕ / A**: pasar. En defensa: cambiar de jugador
  - **○ / B**: robar. Con la pelota: cruce
  - **△ / Y**: saltar · mate · bandeja · **R2 / RT**: correr · **R1 / RB**: dribleo veloz (mantener) y cruce
  - **L1 / LB**: cambiar de jugador · **Share/View**: cámara · **Options/Menu**: menú
- **Configuración → Joystick**: tocá un botón de la lista y apretá el nuevo para reasignarlo (si ya lo usaba otra acción, se intercambian). Zona muerta del stick regulable y botón "Restaurar botones de NBA 2K". Se guarda en el navegador.
- **Menús con el joystick**: cruceta o stick para moverte entre botones y tarjetas, ✕/A acepta, ○/B vuelve. Los sliders se ajustan con izquierda/derecha.
- Vibra suave cuando metés una canasta (si el mando lo soporta). Código en `gamepad.js`.


## Novedades v17 — pausa, controles y joystick dinámico
- **Menú de pausa** (estilo Rocket League): **Esc** o **P** (o **Options/Menu** en el joystick; también si soltás el mouse en cámara libre) → *Reanudar juego*, *Reiniciar jugada* (entrenamiento), *Configuración*, *Controles* y *Salir al menú principal* (pide confirmación). El reloj y la jugada se frenan. Se maneja con teclado, mouse o joystick (○/B reanuda).
- Se sacó el cartel de controles de arriba a la derecha; quedó solo un botón **Pausa**.
- **Controles** (desde la pausa o Configuración): pestañas *Teclado y mouse* y *Joystick*, con "cómo se juega" y todos los botones **reasignables**. El teclado tiene casilla principal y secundaria; acepta botones del mouse; si repetís una tecla, se intercambian. Esc cancela, Retroceso borra. Se guarda en el navegador (`keyboard.js`).
- **Joystick dinámico** (inspirado en EA FC): los botones en pantalla (abajo a la derecha) cambian según la jugada (con pelota / defensa / pelota suelta / cerca del aro); el gatillo de correr es **analógico** (a medias = trote, a fondo = sprint); **flick del stick derecho = cruce** (en cámara libre sigue moviendo la vista). En Configuración podés apagar la ayuda en pantalla y la vibración.

## Novedades v18 — menús fluidos con el joystick
- **Menú previo al partido** con navegación propia: ◀ ▶ cambia de equipo, ▲ ▼ pasa de local a visitante, ✕/A acepta (en el local pasa al visitante; en el visitante sigue), □/X abre la lista de equipos, △/Y elige al azar, ○/B vuelve, **LB/RB** saltan de paso y **Start** continúa.
- **Camisetas:** ◀ ▶ tu camiseta, ▲ ▼ la del rival.
- **Tu equipo:** el cursor recorre titulares, banco y estilo; ✕ elige al titular y el cursor salta solo al banco, ✕ de nuevo hace el cambio; △ ficha, □ arrancar con ese jugador.
- **Partido:** ▲ ▼ opción, ◀ ▶ valor, ✕ ¡Jugar!.
- **Configuración / pausa:** los checkboxes se tocan con ✕ o ◀ ▶, y el primer toque ya mueve el cursor.


## Novedades v19 — canchas por equipo (Chase Center + Gainbridge Fieldhouse)
Cada equipo va a tener su cancha. Una cancha es solo datos en **`courts.js`** (parquet, pintura, logo del centro, pantallas LED, butacas, público, banners y tablero colgante) y `arena.js` arma el estadio con esos datos. Ahora hay dos reales:
- **Chase Center** (Golden State Warriors): la de siempre.
- **Gainbridge Fieldhouse** (Indiana Pacers): parquet gris claro, pintura negra, la **"P" amarilla gigante con la pelota negra** pintada en el centro (con la pintura gastada), tribuna llena de camisetas amarillas, butacas azul oscuro, pantallas LED azules con "PACERS ★ GAINBRIDGE FIELDHOUSE", el nombre del estadio pintado en el parquet junto a las líneas laterales, y banners de ABA 1970/72/73 y campeón del Este 2000/2025.
- Los equipos que todavía no tienen la suya juegan en una **cancha genérica** con sus colores y su escudo (sin banners).

**Entrenamiento → configuración** (`trainsetup.js`): al elegir *Entrenamiento* se abre una pantalla donde elegís la **cancha**, el **equipo** (los 30 escudos) y el **jugador** de su plantel (titulares y banco), y si usás la **camiseta del equipo** (con nombre y número) o la remera de práctica. El jugador lleva su altura, contextura y atributos (los tiros usan sus ratings). Si elegís una cancha y todavía no tocaste el equipo, te propone un jugador del equipo local de esa cancha. Teclado: ← → equipo · ↑ ↓ jugador · Enter entrenar · Esc volver. También anda con joystick. Desde la **pausa** del entrenamiento hay un botón nuevo, *Cambiar cancha / jugador*. Se guarda en el navegador.

**Partido → paso 5 (Partido) → Cancha**: *Local* (la del equipo de la izquierda, por defecto) o *Visitante*. Aparece en el resumen del cruce. Se guarda en el navegador.

**Cómo agregar la próxima cancha** (por ejemplo la de los Celtics): en `courts.js` copiá el bloque `IND`, cambiá los datos y sumalo al arreglo `REAL`. Aparece sola en Entrenamiento y en el partido.

Cambios técnicos: `arena.buildArena(scene, court)` devuelve `dispose()` para cambiar de estadio sin dejar basura en la GPU; `main.js` tiene `setCourt()`; la pintura de la zona ya no sale del color del equipo local sino de la cancha.


## Novedades v20 — cancha de los Charlotte Hornets (Spectrum Center)
- **Spectrum Center** (Charlotte Hornets): parquet claro con rombos suaves, **contorno y zonas turquesa con panal de abejas**, el avispón gigante en el centro, **CHARLOTTE** y **HORNETS** en las líneas de fondo, **BUZZ CITY** en la banda cercana, **@hornets** y **hornets.com** en la banda de la mesa, dos avispones chicos en las esquinas y el cartel **Spectrum CENTER** sobre el parquet. Butacas negras, público turquesa/violeta/blanco y pantallas LED violetas.
- Aparece sola en *Entrenamiento → Cancha* y en el partido (local/visitante) cuando juegan los Hornets.
- Técnico: nuevo campo opcional `surface` en las canchas de `courts.js` (color del contorno, panal, rombos, textos y logos chicos con posición y rotación). `arena.js` lo dibuja en un solo canvas del tamaño del piso (`paintSurface`) y lo apoya sobre el parquet. Sirve para las próximas canchas con contorno de color (Celtics, Lakers, etc.).
- Sin banners por ahora (los Hornets no tienen títulos para colgar).


## Novedades v21 — cinco canchas más: Jazz, Spurs, Lakers, Cavaliers y Rockets
Ahora hay **8 canchas reales** (Warriors, Pacers, Hornets + estas cinco). Aparecen solas en *Entrenamiento → Cancha* y en el partido cuando juega el equipo local (o el visitante, según la opción *Cancha*).
- **Delta Center · Utah Jazz:** parquet claro con líneas **negras** (el borde de la cancha en blanco), zonas azul oscuro con arcos amarillos (uno sólido y otro a rayas), contorno negro con **UTAH JAZZ** amarillo inclinado en las líneas de fondo, la nota con la pelota en negro en el centro, "Delta CENTER" sobre el parquet y PACS / HEALTH en el borde. Banners: campeón del Oeste 1997 y 1998.
- **Frost Bank Center · San Antonio Spurs (cancha de Finales):** parquet casi blanco, zonas negras con arcos grises, contorno negro con **SPURS** blanco, la **espuela sobre el trofeo dorado** en el centro y "Frost Bank CENTER" sobre el parquet. Banners: títulos 1999, 2003, 2005, 2007 y 2014.
- **Staples Center · Los Angeles Lakers:** contorno **amarillo**, zonas violetas, parquet claro, escudo del Lakers en el centro, "STAPLES CENTER" en naranja, dos logos dorados chicos y **LAKERS** violeta en el fondo. Tribuna violeta y dorada. Banners: los 12 títulos desde 1972 hasta 2020.
- **Rocket Mortgage FieldHouse · Cleveland Cavaliers:** contorno y zonas **vino**, parquet crema, la **"C"** con borde dorado en el centro y dos más chicas, **CLEVELAND** y **CAVALIERS** dorados en el fondo, butacas grises. Banners: campeón del Este 2007, 2015, 2017, 2018 y NBA 2016.
- **Toyota Center · Houston Rockets:** parquet dorado cálido, contorno y zonas **rojas**, escudo de los Rockets en el centro, **ROCKETS** blanco en el fondo, TOYOTA CENTER / HOUSTON en las bandas, tribuna roja. Banners: Oeste 1981 y 1986, NBA 1994 y 1995.

Cambios técnicos: las canchas aceptan `lineColor` y `edgeColor` (color de las líneas internas y de las del borde; `main.js` las aplica en `setCourt`), y el bloque `surface` ahora soporta contorno sin panal, `keyArcs` (arcos de color en las zonas), `decor` (trofeo dorado), logos chicos con proporción correcta y textos inclinados (`italic`). El logo central puede ser un recorte con `logo.img` (nuevos `logos/CLE_C.png` y `logos/SAS_SPUR.png`, sacados de los escudos).

## Canchas nuevas (v22)
Se sumaron las canchas de **Bucks** (Fiserv Forum), **Celtics** (TD Garden), **Mavericks** (American Airlines Center), **Timberwolves** (Target Center), **Knicks** (Madison Square Garden), **Thunder** (Paycom Center), **Bulls** (United Center) y **Suns** (Footprint Center). Están en `courts.js` con el mismo formato que las anteriores y aparecen solas en Entrenamiento. Los banners se achican la separación cuando hay muchos (los 18 de Boston).

## Canchas nuevas (v23)
Se sumaron **Nets** (Barclays Center), **Magic** (Kia Center), **Hawks** (State Farm Arena), **Heat** (Kaseya Center), **Grizzlies** (FedExForum), **Pelicans** (Smoothie King Center), **Trail Blazers** (Moda Center) y **Clippers** (Intuit Dome). Ya hay 24 canchas reales. Nuevo en `surface`: `color2` pinta el contorno del lado +X de otro color (lo usan los Blazers: rojo de un lado, negro del otro).

## Canchas nuevas (v24) — ya están los 30 equipos
Se sumaron **Kings** (Golden 1 Center), **Nuggets** (Ball Arena), **Pistons** (Little Caesars Arena), **76ers** (Wells Fargo Center), **Raptors** (Scotiabank Arena) y **Wizards** (Capital One Arena). Nuevo en `surface`: `arcFill` pinta de otro tono la madera adentro del arco de tres (lo usan los Wizards).


## Novedades v25 — de 2 a 4 jugadores en la misma PC
Ahora el **Partido casual** se puede jugar de a **1, 2, 3 o 4 personas en una sola PC**: **J1 con teclado y mouse** y **J2, J3 y J4 cada uno con su joystick**.

**Cómo se arma el partido** (Partido casual → paso 1 *Jugadores*):
- Conectá los joysticks (USB o Bluetooth) y **apretá un botón en cada uno** para que el navegador lo detecte. En el menú, cada joystick que aprieta un botón **entra solo** en la primera casilla libre (J2, J3, J4).
- Cada joystick elige su equipo con **◀ ▶** (◀ = Local, ▶ = Visitante) y sale del partido con **○ / B**. Con el mouse: botones *Local / Visitante* y la ✕ de cada casilla. **J1 (teclado) siempre es del equipo Local.**
- Con eso salen todas las combinaciones: **cooperativo** (todos en el Local contra los bots), **1 vs 1**, **2 vs 1**, **2 vs 2**, etc. El resto de cada equipo lo juegan bots.
- Si no entra ningún joystick, el juego anda exactamente como antes (un jugador, y el joystick también sirve para J1).

**Cómo se juega**
- Cada humano maneja **su propio jugador** (con anillo de su color y la insignia J1–J4 sobre la cabeza). Los botones de cada joystick son los mismos de siempre (se reasignan en *Controles* y valen para todos los joysticks).
- **Un solo humano en un equipo:** funciona como hasta ahora, el control sigue a la pelota (y en defensa, al más cercano).
- **Varios humanos en el mismo equipo:** cada uno se queda con su jugador (si no, se pisarían). Con el botón de cambio (o *pasar* sin la pelota, en el joystick) cada uno puede pasarse a un compañero libre (que no maneje otro humano). Los pases tienen un poquito de preferencia por los amigos humanos.
- **Cámara compartida:** se centra en el grupo de jugadores y la pelota. Con varios jugadores no hay cámara libre (es del mouse de J1). Si juegan en equipos contrarios arranca la **cámara de TV** (se ve parejo para los dos lados; con *C* o el botón de cámara de cualquier joystick se puede pasar a la 2K).
- **HUD:** abajo a la izquierda, una tarjeta por jugador con su color, su jugador, la energía y **su propia barra de tiro** con la línea blanca del tiro perfecto. Se pausa con *Esc/P* o con el botón *Menú* de **cualquier** joystick; la pausa lista a los jugadores.
- **Si se desconecta un joystick** durante el partido: se pausa, su jugador pasa a la IA y, al reconectarlo (aunque cambie de número), vuelve a su dueño.
- **Ayuda de dificultad:** los bots de un equipo que tenga humanos usan el perfil "aliado" (sin los extras de rival); el *estilo de juego* de *Tu equipo* se aplica solo a los bots del Local.

**Cambios técnicos:** `gamepad.js` (`readPad(i)`, `connectedPads()`, `joinPoll()`; la vibración elige joystick) · `prematch.js` (casillas J1–J4, `onJoin`, `getSetup().humans`) · `main.js` (lista `humans`, `takeAgent`, `isHum`, `inputOf`, `padGame(P, dt, h)`, HUD `#mpHud`) · `style.css` e `index.html` (HUD y casillas). Probado por simulación con 1, 2, 3 y 4 jugadores, versus y cooperativo, con entradas aleatorias de todos los jugadores (faltas, tiros libres y saques incluidos).


## Novedades v26 — barra de tiro sobre cada jugador y control libre
**1) Barra de tiro arriba de cada jugador.** Cuando juegan 2, 3 o 4 personas en la misma pantalla, la barra de tiro ya no está en la tarjeta de abajo a la izquierda: aparece **flotando arriba de la cabeza de cada jugador** mientras mantiene el botón de tiro, con su color y su insignia (J1–J4) y la **línea blanca del tiro perfecto**. Se mueve con el jugador y se ve en cualquier cámara. Las tarjetas de abajo siguen mostrando nombre y energía. Con un solo jugador no cambia nada (barra grande abajo).

**2) El teclado ya no es el control fijo de J1.** En *Partido casual → Jugadores*:
- J1 arranca con teclado y mouse **solo como valor por defecto**: si apretás un botón de un joystick, ese joystick **ocupa el lugar de J1** y el teclado queda libre. Así podés jugar solo (o de a dos, tres o cuatro) con joysticks, sin teclado.
- Cada casilla usa el dispositivo que quieras: un joystick propio o el **teclado y mouse (solo uno)**. Para sumar el teclado en una casilla libre hay un botón **⌨ Usar teclado y mouse** (por ejemplo: J1 joystick + J2 teclado).
- Cualquier casilla se puede sacar con la ✕ (o con ○ / B del joystick) y las demás se corren hacia J1. Si no queda nadie, vuelve el teclado por defecto.
- El **primer jugador (J1) siempre es del equipo Local**, con el dispositivo que sea.
- Jugando **solo**, anda el joystick que toques y también el teclado (como antes). Con varios jugadores, el teclado solo mueve a quien lo eligió.

**Cambios técnicos:** `main.js` (`kbHuman()`, `inputOf`/`humanActive` sin atar J1 al teclado, barras flotantes `.pbar` proyectadas con la cámara en `updateMpHud`) · `prematch.js` (casillas con dispositivo libre: `compactSlots`, `kbTaken`, acción `slotkb`, `onJoin` reemplaza el teclado por defecto) · `index.html` (`#mpBars`) · `style.css` (`.pbar`, `.kbadd`).


## Novedades v27 — menú "Tu equipo" arreglado + Casual online (etapa 1)

### 1) Arreglo del menú "Tu equipo" con joystick
- **Qué pasaba:** el marco dorado del cursor (`.pad-cur`) le ponía `position: relative` al elemento. Los nombres de la cancha son `absolute`, así que al pararte sobre uno se salía de su lugar y se estiraba por toda la pantalla (la barra "TOWNS" de tu captura). Además `scrollIntoView` corría todo el menú hacia la izquierda (el título cortado).
- **Ahora:** el cursor ya no toca la posición de nada, el menú nunca se puede desplazar (`overflow: clip`) y el banco se desplaza solo dentro de su lista.
- **Brillo:** el jugador sobre el que estás parado (joystick **o mouse**) brilla: anillo dorado pulsante en la cancha, nombre iluminado y, en el 3D, un haz de luz + anillo + luz puntual (`setGlow` en `stage.js`). El titular elegido para cambiar queda con un brillo fijo más suave.

### 2) Casual online (salas públicas y privadas)
1. Corré **`supabase/004_salas_online.sql`** en el SQL Editor (después del 001). Crea la tabla `rooms` y las funciones `create_room`, `join_room`, `leave_room`, `touch_room`, `set_room_status`, y activa Realtime.
2. Menú principal → **Casual online** (debajo de Partido casual). Hace falta **cuenta** (no sirve "continuar sin cuenta").
3. **Lobby:** lista de partidas públicas (se actualiza sola), **entrar con código** (sirve para públicas y privadas) y **Crear partida**.
4. **Crear partida:** nombre, **pública/privada** y las **reglas del partido** (cancha, nivel de los bots, duración del cuarto, 24 s, cansancio, cambios). Solo las define el anfitrión.
5. Al crear o entrar se abre el **mismo menú previo del casual** (Equipos → Camisetas → Tu equipo → Partido), con estas diferencias: cada uno elige **solo su** equipo, camiseta y alineación (el rival se ve en vivo y no se toca); el paso Partido muestra las reglas con 🔒 y el panel de la sala; cada uno marca **Estoy listo** y el anfitrión toca **Empezar partido**. Si las camisetas chocan, la cambia el invitado. Cámara y altura de cámara son personales.
6. Salir de la sala (Esc en el primer paso) pregunta antes: si salís de anfitrión se cierra la sala; de invitado queda libre.

**Estado (v27):** era la **etapa 1** (salas, lobby, menú sincronizado en vivo y "todo listo"). Todavía **no corre el partido sincronizado**: al empezar aparece una pantalla de "¡Todo listo!" con los dos equipos. `PM.getSetup()` ya devuelve el partido armado para online (anfitrión = Local, invitado = Visitante) y el canal `sala:<id>` ya existe, listo para la **etapa 2** (mandar movimientos, pelota y marcador).

**Archivos:** `online.js` (lobby, salas, canal en vivo) · `prematch.js` (modo online del menú previo) · `supabase/004_salas_online.sql` · `ui.js`/`main.js`/`index.html`/`gamepad.js`/`style.css` (conexiones y estilos).


## Novedades v28 — el partido online ya se juega (etapa 2)

No hay que correr nada nuevo en Supabase (sigue siendo el `004_salas_online.sql`). Cuando los dos marcan "Estoy listo" y el anfitrión toca **Empezar partido**, arranca la cancha para los dos.

**Cómo funciona**
- **El anfitrión simula todo** (los 10 jugadores, la pelota, faltas, tiros libres, árbitro, bots). Es el mismo motor del casual, con el invitado como "segundo humano" cuyos controles llegan por la red. Así las reglas son idénticas y nadie puede hacer trampa desde su lado.
- **El invitado no simula**: manda sus controles (30 por segundo, solo si cambian) y sus acciones (tirar, pasar, robar, cambiar, cruce), y dibuja lo que recibe del anfitrión (20 snapshots por segundo, ~2,2 KB cada uno) interpolando ~110 ms en el pasado para que se vea fluido.
- **Barra de tiro del invitado**: corre en su propia pantalla sin esperar a la red y al soltar manda su valor, así el tiro perfecto no depende del ping.
- **Conexión**: primero intenta **directa entre los dos (WebRTC, `net.js`)**: menos demora y no gasta mensajes de Supabase. Si la red no lo permite, usa el canal de Supabase automáticamente (más lento, pero siempre anda). `Online.linkState()` dice cuál se está usando.
- Cada uno ve la cancha desde su jugador (cámara 2K o TV; no hay cámara libre online). Cada equipo usa el estilo de juego que armó su dueño.
- **Menú de pausa online**: abre el menú pero el partido **no se frena** (el rival sigue jugando). "Abandonar partido" avisa al rival; el anfitrión vuelve a la sala y, si se va el anfitrión, la sala se cierra.
- Al terminar el partido aparece el resultado para los dos (XP: 10 por jugar + 25 por ganar) y "Volver a la sala" lleva al último paso para pedir **revancha** o cambiar equipos.
- Si uno se desconecta más de 10 segundos en pleno partido, se corta y el otro vuelve a la sala.

**Límites a tener en cuenta**
- El partido corre en la PC del anfitrión: si su pestaña queda en segundo plano el navegador la frena y se frena para los dos. Conviene que el anfitrión sea quien tenga mejor internet/PC.
- El invitado ve el juego con la demora de la conexión (~100–200 ms con P2P, algo más por Supabase). Lo del tiro está compensado; el movimiento y los pases tienen esa demora.
- Por Supabase (sin P2P) un partido manda ~45 mensajes por segundo; el plan gratis incluye 2 millones de mensajes al mes (≈ 11 horas de partido). Con P2P casi no gasta.
- "Nivel de los bots" no aparece online: los dos equipos tienen un humano y no cambia nada.

**Archivos nuevos/tocados:** `net.js` (conexión directa + respaldo), `netsync.js` (buffer de snapshots e interpolación), `online.js` (arranque/fin/abandono del partido), `main.js` (sección "Partido online": snapshots del anfitrión, visor del invitado, controles por red), `prematch.js` (`hideForMatch`, `resumeOnline`, estilo por equipo).


## Novedades v29 — cada joystick maneja solo lo suyo
**Qué pasaba:** con 2 joysticks en la misma PC, si el segundo no se había anotado en el menú, el juego usaba "el joystick que toques" y el control **saltaba de uno a otro en cada cuadro** (se trababa y los dos movían al mismo jugador).

**Qué cambió**
- **Joysticks que entran solos:** al abrir *Partido casual* con 2 o más joysticks ya detectados, entran automáticamente (J1 = Local, J2 = Visitante, J3 y J4 según su casilla). Se pueden sacar con la ✕ o ○ / B. Si un joystick se conectó después, se suma apretándole un botón en el paso *Jugadores* (ahora entran todos los que aprieten en el mismo instante) y el menú avisa "hay 2 conectados y 1 anotado".
- **Cada mando, su jugador:** un solo jugador con su joystick ya no es afectado por los otros mandos conectados. Con varios jugadores cada joystick maneja solo al suyo (movimiento, tiro, pase, robo, cambio, vibración), y el teclado solo mueve a quien lo eligió.
- **Mando activo estable** (`gamepad.js`): en menús y pausa, el mando que estás usando ya no te lo roba otro que también está apretando botones.

**Archivos tocados:** `gamepad.js` (mando activo estable, `joinPollAll`), `main.js` (`inputOf`, `sep` en el bucle), `prematch.js` (`autoEnrollPads`, aviso de joysticks sin anotar).

**Probar:** conectá 2 mandos, apretá un botón en cada uno, abrí *Partido casual*: deberías ver J1 (Local) y J2 (Visitante) ya anotados. Jugá 1 vs 1: cada uno mueve, tira, pasa y roba solo con el suyo.


## Novedades v30 — más animaciones: mates, bandejas, tapones y pases con lujo
**Botón de lujo (modificador):** mantené **L2 / LT** en el joystick (o **Z** en el teclado; se reasigna en *Controles*) y apretá la acción. Sin apretarlo, las variantes también salen de vez en cuando (más seguido en los bots con buen rating).

**Mates nuevos** (corriendo hacia el aro + saltar, con lujo): *de espaldas* · *por debajo de la pierna* (la pelota pasa de una mano a la otra bajo el muslo) · *molino* · *360* · combos *pierna + de espaldas* y *molino + 360*. El mensaje en pantalla dice cuál fue.

**Bandejas nuevas** (cerca del aro, más lento): *a tablero* (pega en el vidrio y entra) · *finger roll* (gira sobre el aro y entra o sale) · *con la palma arriba* (scoop) · *reversa* · *euro step* · *floater* (arco alto). La pelota de tablero y de giro se elige con un simulador (`shotsim.js`) que repite la física del juego, así que el rebote es real y no un truco.

**Tapones:** 4 estilos — dos manos, una mano, de persecución (cuando el tirador te da la espalda) y manotazo hacia abajo (*spike*). **Ahora se puede taponar un mate o una bandeja en el aire** (saltá con *taponar* cuando el rival ya despegó). Resultados posibles: tapón limpio, tapón **con falta** (tiros libres), falta sin tapón (si el mate entra: y-uno) o roce sin consecuencias. Depende del rating de *tapones* contra el de mate/bandeja y de la altura. Los bots también lo intentan.

**Pases con lujo** (L2 + pasar): *por la espalda* · *sin mirar* · *envolviendo* · *por arriba de la cabeza* · *de pique* (la pelota pica una vez y llega a la cintura). Salen un instante después de armar el movimiento y tienen un poco más de riesgo de error.

**Online:** el invitado ve todas las animaciones (viajan como articulaciones) y su botón de lujo se manda al anfitrión.

**Archivos:** `main.js` (catálogos `DUNKS` / `LAYS`, `startDunk`, `updateDunk`, `checkDunkBlocks`, `launchPass`, `poseDunkX`, `poseLayX`, `poseFlashPass`, `blockPose`), `shotsim.js` (nuevo), `ai.js`, `gamepad.js`, `keyboard.js`, `controls.js`.
**Ojo:** no pude abrir el juego en un navegador mientras lo armaba (sin internet para Three.js); verifiqué la sintaxis, la física de pelota con simulaciones y las posiciones de brazos con cinemática. Si alguna pose se ve rara, avisame cuál y la ajusto.


### v30.1 — floater corregido + dribleos con lujo
- **Floater:** se quedaba corto porque el cálculo del tiro suponía más efecto de rotación del que lleva la pelota. Ahora se resuelve con el mismo efecto con el que sale (en pruebas pasó de entrar 45 de 200 a 200 de 200). Las demás bandejas no cambian.
- **Dribleos con lujo:** mantené **L2** (o **Z**) y apretá el botón de **cruce/dribleo** (o el flick del stick derecho): *por abajo de las piernas*, *por la espalda*, *stepback* (te despegás hacia atrás y el próximo tiro queda mucho menos marcado) y *giro* (vuelta completa protegiendo la pelota). Gastan más energía que un cruce normal y dejan sentado al defensor más seguido (menos el stepback). Los bots con buen manejo también los usan de vez en cuando. Código: `MOVES` y `startCrossover` en `main.js`.


## Novedades v32 — los jugadores juegan según sus estadísticas
Todas las curvas están en **`skill.js`** (un solo archivo, para ajustar a gusto). Referencia: 70 = normal, 99 = élite, 40 = muy flojo. Usa los atributos de la base (`three_point`, `mid_range`, `stamina`, `speed`, `vertical`, etc.); si a un jugador le faltan, se estiman como antes.

**Tiro (volumen y rango, no solo %)**
- Cada bot decide si tira según el rating **de la zona**: triple, media distancia o cerca del aro. Un Curry (triple 99) se anima con menos espacio y **desde mucho más lejos** (10 m+); un 85 como Maxey tira de tres pero no desde el logo; un pívot con triple 40 casi no tira de afuera salvo que se acabe el reloj.
- Efectividad: sube suave hacia 99 y cae más rápido hacia abajo (triple 99 ≈ 51 %, 70 ≈ 40 %, 40 ≈ 21 % en tiros abiertos).
- Las estrellas (ovr alto) tiran y reciben la pelota un poco más.
- **Si jugás vos:** el rating de la zona agranda o achica la ventana del tiro perfecto y el error del tiro (con Curry el "verde" es más ancho que con un pívot).
- Bandejas: pesan `driving_layup` y la `strength` contra la marca. Mates: hace falta `driving_dunk` + `vertical` suficientes; si no, hace bandeja (un base con mate 40 ya no machaca).

**Físico**
- **Resistencia (`stamina`)**: se cansa más lento y recupera más rápido (99 → ×0.65 de gasto y ×1.35 de recuperación; 40 → ×1.36 y ×0.64). Incluye cruces, dribleo y banco. Un jugador con stamina 90 aguanta sprints mientras un 55 ya va lento.
- **Velocidad** (más rango: 40 → ×0.80, 99 → ×1.10) y **aceleración / cambios de dirección**.
- **Salto (`vertical`)**: altura del salto de tiro, tapón y rebote; también pesa contra el tapón a un mate.

**Defensa y rebote**
- Intentan más robos/tapones los que tienen más `steal` / `block`; el robo depende bastante más de `steal` vs `ball_handle` (y velocidad). El buen defensor perimetral marca más pegado.
- Rebotes: `off_rebound` / `def_rebound` (según si es de tu equipo el tiro) + fuerza + salto + altura.

**Archivos:** `skill.js` (nuevo), `ai.js`, `main.js` (`setInfo`, `updateAgent`, `releaseBall`, `startDunk`, `tryDunk`, `resolveSteal`, rebotes).
**Ojo:** no pude abrir el juego en el navegador; verifiqué la sintaxis y las curvas con un script de prueba (tiros y físico por jugador). Si ves que algo se pasa de fuerte o flojo, tocá los números de `skill.js`.


## Novedades v33 — jugadores que se parecen a los reales
Cada jugador toma del dato de la base su **altura, peso, piel, pelo, barba y accesorios**. Todo lo visual está en `looks.js` (tabla de jugadores conocidos + reglas de tamaño) y en `rig.js` (el modelo).

**Tamaño y cuerpo**
- **Altura real:** antes el tamaño se achataba entre 0,93 y 1,08; ahora va de 0,88 a 1,16 (el modelo base mide 1,98 m). Wembanyama (7'4") sale ×1,13; un base de 5'3" sale ×0,88. Se nota en cancha y en el alcance real al aro, tapones y rebotes.
- **Contextura:** sale del IMC (peso y altura) y un poco de la `strength`. Wembanyama queda flaco y largo; Jokic o Embiid, corpulentos. Rango ampliado (0,88–1,16).

**Piel, pelo y accesorios** (`rig.js`)
- Peinados nuevos: **trenzas, rodete, cola / pelo largo atado y rizos largos** (se suman a pelado, corto, rapado, afro y high top).
- **Color de pelo** (negro, castaño, rubio teñido…), **barba** (corta o tupida), **vincha** (se ajusta al tamaño del pelo; sobre un pelado queda sobre el cráneo) y **manga de compresión** en uno o ambos brazos.

**De dónde sale el aspecto de cada uno** (prioridad)
1. Columnas de la base (`supabase/005_aspecto.sql`): `hair_style`, `hair_color`, `beard`, `headband`, `arm_sleeve`, `sleeve_color` y `skin_tone`.
2. La tabla de `looks.js` con ~80 jugadores conocidos (por nombre, sin importar tildes ni mayúsculas): LeBron (piel oscura, vincha negra), Caruso (pelado, vincha blanca), LaMelo (rubio teñido, rizos largos), Jokic (pelo largo atado, barba), Wembanyama, Curry, Giannis, etc.
3. Si no está, se estima desde el nombre (como antes); si es de piel clara, el pelo sale castaño en vez de negro.
- Para los conocidos, `skin_tone = 2` (el valor por defecto de la tabla) se ignora y manda la tabla. Si corrés el 005 queda todo cargado en la base y podés editarlo ahí.

**Cómo corregir o agregar un jugador:** en el SQL Editor, por ejemplo `update public.players set hair_style = 5, hair_color = '#15120f', headband = '#ffffff' where name ilike 'Nombre Apellido';`. También podés agregarlo en `looks.js` (`KNOWN_RAW`).

**Archivos:** `looks.js` (nuevo), `supabase/005_aspecto.sql` (nuevo), `rig.js`, `rig-geo.js`, `roster.js`, `main.js`, `stage.js`.
**Ojo:** no pude verlos en un navegador (verifiqué que el modelo se arme sin errores con todos los peinados y que la vincha quede ajustada a cada peinado). Los rasgos de la tabla son de memoria y pueden estar desactualizados (pelo, barba): decime cuáles cambiar.


## Novedades v34 — peinados con volumen, más jugadores, cámara TV y arreglos
**Peinados (antes se veían todos pelados):** el rapado era una capa de 1–6 mm, casi invisible sobre piel oscura. Ahora el pelo tiene más volumen (corto y rapado más gruesos) y hay estilos nuevos: **9 corto-medio** (Luka, Klay, Herro, Reaves…) y **10 rizado medio** (con rulos de verdad: Murray, Haliburton, Maxey, Kyrie, Jarrett Allen…). Los rizos largos (8) también llevan rulos; las trenzas (5) son más gruesas (Shai, Siakam). `hair_style` va de 0 a 10; corré de nuevo `supabase/005_aspecto.sql` (amplía el rango).

**Más jugadores:** ~110 en la tabla de `looks.js` (sumé jóvenes y rotación: LaVine, Smart, Jarrett Allen, Jaren Jackson Jr., CJ McCollum, Ingram, Strus, Duncan Robinson, Horford, etc.). Para agregar o cambiar uno: `KNOWN_RAW` en `looks.js` o un `update` en la base.

**Entrenamiento — elegir jugador:** no se podía cambiar porque el id del jugador en la base es un número y el botón lo devolvía como texto, así que siempre caía en el primer titular. Arreglado en `trainsetup.js` y `main.js` (también el resaltado del elegido y las flechas ↑ ↓). Desde la pausa: *Cambiar cancha / jugador*.

**Cámara de TV por defecto:** en el partido y en el entrenamiento. Si habías guardado otra cámara, vuelve a TV una vez (después se respeta lo que elijas).

**Número de la camiseta que se borraba:** el modelo se ensancha con la contextura (hasta ×1,16), pero el número, las franjas de la camiseta y los vivos del short se quedaban con el ancho original, y en los jugadores corpulentos quedaban **adentro de la tela**. Ahora escalan juntos (`rig.js`, `setBuild`) y el número queda un poco más separado de la tela.

**Archivos tocados:** `rig-geo.js`, `rig.js`, `looks.js`, `trainsetup.js`, `main.js`, `prematch.js`, `supabase/005_aspecto.sql`.
**Ojo:** no pude abrir el juego en un navegador; verifiqué que el modelo se arme con todos los estilos y que camiseta y número escalen igual. Si algún peinado se ve raro, decime cuál y lo ajusto.


## Novedades v35 — más jugadores con rasgos propios y joystick con inercia
**Jugadores y detalles (`looks.js`, `rig.js`, `supabase/006_accesorios.sql`)**
- **Jaylen Brown: manga blanca en el antebrazo izquierdo**, como pediste. Para cualquier jugador se puede indicar manga (`arm_sleeve`), y ahora también **muñequera** y **rodillera** (izq / der / ambas, con color).
- Rasgos agregados o corregidos: **LeBron** sin vincha (hace una década que no la usa) y con manga negra en el brazo derecho · **Curry** con manga en el izquierdo · **vinchas** en Jimmy Butler, Anthony Davis, Shai, Siakam y Jalen Suggs · **rodillera** izquierda en Embiid.
- **~50 jugadores nuevos** en la tabla (ahora ~160): DeRozan, Derrick White, Jalen Green, Amen y Ausar Thompson, Castle, Bane, Pritchard, Hauser, Porter Jr., Kuminga, Scoot Henderson, Clingan, Quickley, RJ Barrett, Sarr, Risacher, Dylan Harper, VJ Edgecombe, Knueppel, etc.
- Para cambiar a uno: `KNOWN_RAW` en `looks.js` (por ejemplo `X(L(3, 2, K, 1), { wrist: 'R', wristColor: W })`) o un `update` en la base (corré el 006 una vez).

**Joystick (`gamepad.js` → `STICK`, `main.js` → `steerStick`)**
- El stick ya no apunta el rumbo de golpe como un mouse: las direcciones se **pegan a 16 rumbos** (caminar derecho no cuesta), la inclinación tiene una **curva** (poco = caminar fino) y el jugador **gira con inercia**: parado cambia casi al instante, pero a toda velocidad hace una curva (180° a sprint ≈ 0,6 s). Los de mejor aceleración / cambio de dirección doblan más cerrado.
- Todo se ajusta en un solo bloque, `STICK` (`gamepad.js`): `turnRun` más alto = giros más rápidos, `curve` 1 = lineal.
**Ojo:** no pude abrirlo en un navegador; verifiqué la sintaxis, la tabla de looks y la curva del stick con scripts. Los rasgos son de memoria + búsqueda y pueden estar desactualizados.

**Joystick en los menús (v35, `gamepad.js` → `menuNav`)**: antes el cursor saltaba al elemento más cercano en cualquier dirección (como un mouse). Ahora es por **filas**: ← → solo se mueven dentro de la fila, ↑ ↓ pasan a la fila de arriba o abajo y caen en el elemento más alineado, sin saltos en diagonal. Con el stick cuenta solo el eje dominante (empujar medio en diagonal ya no mueve en dos sentidos). Los pasos del menú previo al partido ya tenían su propia navegación y no cambian.

**Pelota con modelo 3D (v37, `assets/ball.glb`)**: la pelota ahora es una NBA Wilson (logos, costuras y relieve de cuero) en vez de la esfera con textura dibujada. Es un GLB de 768 triángulos con texturas de 1024 px (2,2 MB). Viene centrada y con radio 0,12 m, así que la física, el giro y las manos no cambian. Si el archivo no carga, el juego sigue con la pelota básica. `index.html` ahora tiene un `importmap` para poder usar `GLTFLoader` (también te va a servir para los modelos de jugadores). Para cambiar la pelota, reemplazá `assets/ball.glb` (centrada en el origen y radio 0,12).

**Cancha 3D del Chase Center (v38, `assets/gsw_court.glb`)**: cuando jugás con la cancha de los Warriors, el piso es el modelo 3D (parquet, líneas azules, logo gigante, "Golden State Warriors" en los fondos, Oracle Arena, NBA) y los aros tienen los soportes acolchados con los logos (Spalding, NBA, warriors.com). La tribuna, las pantallas LED, los banners y el tablero colgante siguen igual. Pesa 400 KB (texturas bajadas de 4096 a 1024).
- El modelo está calibrado al juego: líneas de fondo en ±14,325 m y de banda en ±7,62 m, y aros en ±12,75 m, así que **la física no cambió**. El aro con su red animada sigue siendo el del juego (el del modelo se sacó para no duplicarlo).
- Las otras 29 canchas siguen usando la cancha generada por código. Si el GLB no carga, también.
- Para otra cancha con modelo: agregá `model: 'assets/lo-que-sea.glb'` en su bloque de `courts.js` (piso en `y = 0`, centrado, con nodo `piso`; el resto se muestra tal cual).


## Novedades v39 — personaje 3D con esqueleto (Stephen Curry) usando las animaciones del juego
**Qué hay:** `assets/curry.glb` (Curry con camiseta de los Warriors, cara y 140 huesos) y `rig-glb.js`. Cuando el jugador en cancha se llama **Stephen Curry** (así figura en `players.name` de Supabase), se ve el modelo 3D en vez del cuerpo procedural. El resto de los jugadores no cambia.

**Cómo funciona (y por qué las animaciones andan solas):** el GLB no trae ninguna animación, así que no hizo falta crear ninguna. El cuerpo procedural de `rig.js` sigue vivo pero invisible, como "motor de animación": todas las poses del juego (correr, driblear, tirar, mates, bandejas, tapones, pases con lujo, tiros libres, celebraciones) se calculan igual que siempre, y `rig-glb.js` copia cada cuadro la orientación de torso, cabeza, brazos y piernas al hueso equivalente del GLB. Por eso la pelota en la mano, la IA, la física y el online no se tocaron: el invitado online también ve el modelo, porque lo mueve la misma pose que ya viaja por la red.
- **IK de brazos y piernas:** las proporciones del GLB son distintas (brazos más cortos, piernas más largas). Las manos se llevan a las manos del cuerpo procedural (para que la pelota quede en la mano) y los pies a sus pies (apoyados en el piso). Los brazos del GLB se alargan un 15 % (`ARM_STRETCH`).
- **El GLB se re-procesó:** traía una escala no uniforme (0,86 × 1,13 × 0,86) en un nodo padre, que deformaba brazos y piernas al rotarlos. Se "horneó" en la malla y los huesos, se normalizó la altura a 1,98 m (el juego lo escala a la altura real de cada jugador) y las texturas bajaron de 4096 a 2048 px (7,2 MB → 6,3 MB).
- **Probar sin Supabase / con los 10 jugadores:** abrí el juego con **`?modelo3d=todos`** en la dirección (ej: `http://localhost:3000/?modelo3d=todos`). Pone el modelo de Curry en los 10 (todos con camiseta de los Warriors): sirve para medir rendimiento y ver las animaciones.

**Lo que NO está todavía (para pasar a "todos 3D" de verdad):**
- Un modelo por jugador, o un cuerpo base con camiseta, short y piel separables: este GLB trae uniforme y piel pintados en una sola textura, así que no se puede cambiar de equipo ni de color.
- Dedos: no se cierran sobre la pelota (el GLB mantiene la mano abierta).
- Menús (camisetas / tu equipo) y árbitro siguen con el cuerpo procedural.
- Peso: ~97 000 vértices por personaje. Para 10 en pantalla conviene una versión de 15 000–20 000.
- **Ojo:** no pude abrirlo en un navegador (sin internet para Three.js); verifiqué la sintaxis y la matemática del retargeting y la IK con un script (huesos íntegros, pies en el piso, manos al alcance) y que malla y esqueleto del GLB coinciden. Si alguna pose se ve rara, decime cuál.


## Novedades v40 — LeBron James en 3D (`assets/lebron.glb`)
- **Nuevo personaje 3D con esqueleto: LeBron James** con camiseta y short blancos de los Sixers (diseño Association: SIXERS al frente, JAMES 23 atrás), manga blanca en el brazo, rodillera y zapatillas blanco/azul/rojo. Cara, barba y tatuajes del modelo original.
- Usa **el mismo sistema que Curry** (`rig-glb.js`): el cuerpo procedural sigue siendo el motor de animación (invisible) y el GLB copia cada pose cuadro a cuadro, con IK en brazos y piernas. Por eso dribleo, tiros, mates, pases, bloqueos, robos y la IA funcionan igual, sin tocar nada de eso.
- El GLB está horneado como el de Curry: huesos con los mismos nombres (`pelvis`, `spine_01/03/05`, `neck_01`, `head`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`, `foot_l`… y los de la derecha), sin escalas en la jerarquía, mirando a +Z y de **1,98 m de base** (el juego lo escala por la altura real: 206 cm → x1,04). Unos 87 mil vértices (Curry tiene 97 mil).
- `main.js`: cada jugador elige su modelo por nombre (`LeBron James` → lebron.glb, `Stephen Curry` → curry.glb). Si un suplente reemplaza al jugador, el modelo se cambia solo.
- `rig-glb.js`: el estiramiento de brazos ahora se calcula según el modelo (antes era fijo para Curry; con Curry da el mismo 1,15).
- **Para probar en los 10 jugadores:** `?modelo3d=lebron` (todos con LeBron) o `?modelo3d=todos` (todos con Curry).
- Para que aparezca en un partido, LeBron tiene que estar en el plantel con el nombre `LeBron James` (por ejemplo en `players` de Supabase, equipo PHI).
- Crédito (licencia CC-BY 4.0): modelo base "Lebron James" de delaydlegend, Sketchfab. Retexturizado y optimizado para este juego.


## Novedades v41 — modo carrera + Curry como personaje del juego
- **Modo carrera DT de la v37 integrado en la v40.** Menú principal → *Modo carrera — DT* (ya no figura como "pronto"). Se copió la carpeta `career/` y su `career.css`, y en `main.js` / `index.html` / `ui.js` se agregaron los mismos ganchos que tenía la v37 (abrir la carrera, devolver el resultado y los puntos de cada jugador, abandonar partido, no abrir la pausa con el menú de carrera encima).
- **Se mantiene todo lo de la v40:** pelota GLB, cancha 3D del Chase Center y LeBron 3D (`assets/lebron.glb`). En la carrera, un jugador llamado `LeBron James` también se ve con su modelo 3D.
- **Curry ya no usa modelo 3D:** se borró `assets/curry.glb` y su carga en `main.js`. Vuelve al cuerpo del juego con su aspecto de `looks.js` (piel 2, pelo corto, sin barba, manga negra en el brazo izquierdo), igual que el resto de los jugadores. `?modelo3d=todos` ya no hace nada; queda `?modelo3d=lebron`.
- **`roster.js` es el de la v37** (OVR entre 25 y 100): la carrera necesita ese rango para promesas de secundaria y jugadores de 100. La v40 lo había limitado a 40–99.
- **Sin probar en navegador:** revisé la sintaxis de todos los .js y que ningún `import` apunte a un archivo inexistente, pero no pude correr el juego. Si algo de la carrera se rompe al jugar un partido en 3D, decime qué pantalla.


## Novedades v42

### Canchas 3D de Spurs, Rockets, Hornets y Lakers
- `assets/sas_court.glb`, `hou_court.glb`, `cha_court.glb`, `lal_court.glb`: se conectan igual que la de los Warriors. En `courts.js` cada equipo tiene `model` y `apron` (color del contorno).
- Están **calibradas al juego**: las líneas de fondo y banda caen en ±14,325 y ±7,62 y los tableros quedan detrás de los aros del juego (que siguen siendo los de la física). Del modelo original se sacaron el aro, la red y el faldón (el juego ya tiene los suyos) y las texturas de 4096 bajaron a 1024 (el piso queda en 2048): cada cancha pesa ~0,7 MB.
- Se baja solo la cancha del equipo que se usa y se libera la anterior. Si el archivo no carga, queda la cancha de siempre.
- Para sumar otra: `python3 tools/calibrar_cancha.py archivo.glb abreviatura` (necesita `numpy` y `Pillow`) y agregar `model` / `apron` en su bloque de `courts.js`.
- Crédito de los modelos: Wayne Pearce (Sketchfab), licencia CC-BY-4.0, a partir de «Golden State Warriors Home Court».

### Tabla de puntos (mantener y soltar)
- **Tab** (teclado) o **← de la cruceta** (joystick) mantenido = se ve la tabla; al soltar se va. Ambos se pueden cambiar en *Configuración → Controles* («Tabla de puntos»).
- Funciona en partido casual, online (anfitrión e invitado; el resumen viaja dentro de los snapshots) y partidos de la carrera. En entrenamiento muestra la sesión. No se abre con la pausa o los menús abiertos.
- Muestra por jugador: minutos, puntos, rebotes, asistencias, robos, tapones, pérdidas, tiros de campo, triples, libres y faltas; puntos por cuarto, totales y porcentajes del equipo. Un punto verde marca a los que están en cancha.
- Todo está en `boxscore.js`; las estadísticas se suman desde `main.js` con `bx(jugador, 'campo')`.

## Novedades v43 — Tyrese Haliburton en 3D
- (reemplazado en v45 por los 4 modelos por uniforme) `assets/haliburton.glb`: modelo de Meshy con esqueleto Mixamo (72 huesos, con skin), uniforme de los Pacers. Se redujo de 47 MB a 4,4 MB (texturas a 2048/1024), se escaló a 1,98 m (el juego lo ajusta por altura real, como a todos) y se le sacaron las animaciones Walking/Running: el juego anima por código.
- Se activa solo cuando `players.name` contiene "Haliburton" (igual que LeBron). Para probarlo en los 10 jugadores: `?modelo3d=haliburton`.
- `rig-glb.js` ahora entiende esqueletos Mixamo (`mixamorig:Hips`, `Spine`, `LeftArm`…) además de los tipo Unreal; sirve para sumar más jugadores hechos con Meshy + Mixamo (agregá la clave en `GLB` y la regla en `which3D`, en `main.js`).

## Novedades v44 — Warriors en 3D (Curry, Draymond Green, Melton, Podziemski, Richard)
- Nuevos modelos con esqueleto Mixamo (mismo sistema que Haliburton): `assets/curry.glb`, `draymond.glb`, `melton.glb`, `podziemski.glb` y `richard.glb`. Cada uno pesaba ~46 MB; ahora ~3,5–4,5 MB (texturas a 2048 px el color y 1024 px normal y rugosidad, en JPEG), sin las animaciones Running/Walking que traían (el juego anima por código) y escalados a 1,98 m de base (el juego los ajusta a la altura real con `scaleFor`).
- `main.js`: se agregaron las claves en `GLB` y las reglas en `which3D`. El modelo aparece solo cuando `players.name` contiene `Stephen Curry`, `Draymond`, `Melton`, `Podziemski` o `Will Richard`. Si el nombre de Supabase es distinto, hay que ajustar la regla.
- Probar un modelo en los 10 jugadores: `?modelo3d=curry`, `?modelo3d=draymond`, `?modelo3d=melton`, `?modelo3d=podziemski` o `?modelo3d=richard`.
- Verificado por script: los 5 tienen los huesos que pide `rig-glb.js` y las cadenas hombro→codo→mano y cadera→rodilla→pie para la IK. Sin probar en navegador (sin internet para Three.js): si alguna pose se ve rara, decime cuál.

## Novedades v45 — Haliburton en 4 uniformes y camisetas 3D de los Pacers
**Solo Indiana Pacers.** Los otros 29 equipos y sus jugadores no cambian (comprobado: `kitsFor` da exactamente lo mismo que en v44 para todos menos IND).

- **4 modelos de Haliburton, uno por uniforme** (`assets/haliburton/`, archivos originales sin tocar): el juego elige el modelo según la camiseta que tiene el equipo (no se cambian texturas de un mismo modelo).
- **4 camisetas 3D en el menú** (`assets/uniformes/`, originales sin tocar): en el paso *Camisetas*, si el equipo es IND, cada botón muestra su camiseta girando en 3D (en vez del dibujo plano).
- Correspondencia (id de camiseta de `kits.js` → archivos):

| Camiseta | id | Modelo de Haliburton (menú y partido) | Camiseta 3D del botón |
|---|---|---|---|
| Icon (azul oscura) | `icon` | `haliburton/haliburton_icon.glb` (era «haliburton azul oscuro») | `uniformes/uniform_icon.glb` |
| Association (blanca) | `association` | `haliburton/haliburton_association.glb` (era «haliburton blanca») | `uniformes/uniform_association.glb` |
| Statement (amarilla) | `statement` | `haliburton/haliburton_statement.glb` (era «haliburton amarillo») | `uniformes/uniform_statement.glb` |
| Classic (azul claro con línea amarilla) | `city` | `haliburton/haliburton_city.glb` (era «haliburton azul claro con linea amarilla») | `uniformes/uniform_city.glb` (era `uniform_classic_opt`) |

- Los pares se determinaron mirando el color de la textura de cada archivo. Para IND, la 4.ª camiseta (id `city`, antes City negra) ahora es **Classic** (azul claro con línea amarilla), porque ninguno de los 4 modelos es negro. Cambio en `kits.js`, solo para IND.
- **Carga bajo demanda** (`pacers3d.js`): cada Haliburton pesa ~45 MB (texturas de 4096 px), así que no se bajan al arrancar. Se baja solo el de la camiseta en uso; al apretar *Jugar* el juego espera a que esté cargado (así no aparece el cuerpo de siempre un rato) y los que dejan de usarse se liberan de memoria. Si un archivo no carga, queda el cuerpo de siempre con los colores de la camiseta y el juego sigue.
- **Tamaño**: los modelos nuevos miden 1,70 m y el resto del juego espera 1,98 m. `rig-glb.js` acepta `gltf.fitScale` (escala **uniforme**, sin deformar ni tocar el archivo): 1,98 / 1,70 ≈ 1,165. Los demás modelos no lo usan (siguen idénticos).
- **Dónde se ve el modelo**: partido (incl. carrera y online), entrenamiento (con la camiseta del equipo = Icon; con la remera blanca de práctica = Association) y los pasos *Camisetas* y *Tu equipo* del menú, que usan el mismo modelo que el partido. Con otro equipo (por ejemplo si lo cambiás en la carrera) Haliburton queda con el cuerpo de siempre y los colores de ese equipo.
- Para probar: `?modelo3d=haliburton` pone el Haliburton de la camiseta de cada equipo en los 10 jugadores (solo para pruebas).
- Las camisetas 3D de los botones muestran las texturas a 1024 px (los botones miden ~130 px) para que 4 quepan en memoria; los archivos y el modelo del jugador usan las texturas originales de 4096 px.
- Archivos tocados: `pacers3d.js` (nuevo), `main.js`, `stage.js`, `prematch.js`, `rig-glb.js`, `kits.js`, `style.css`. Se quitó `assets/haliburton.glb` (ya no se usa).
- Sin probar en navegador (sin internet para Three.js en este entorno): verificado por script que los 8 archivos son copias exactas, que los 4 modelos tienen los huesos y la jerarquía que pide `rig-glb.js`, y que el resto de los equipos conserva sus camisetas.


## Novedades v48 — jugadores 3D por carpetas (y se van las camisetas 3D del menú)
- **Una carpeta por equipo y por jugador**: `assets/jugadores/<equipo>/<nombre_apellido>/<nombre_apellido>_<N>.glb`. `N` = la camiseta que usa: **1 Icon · 2 Association · 3 Statement · 4 City** (el orden de los botones del menú). Ya están creadas las 520 carpetas de los 30 equipos (salen del CSV de Supabase; la lista exacta está en `assets/jugadores/LISTA.txt`).
- **Si el archivo existe, el juego lo usa** (en el partido, el entrenamiento y el escenario 3D del menú). **Si no existe, usa el cuerpo que arma el juego** (`rig.js`), como siempre. No hay que registrar nada: copiás el `.glb` a su carpeta y listo.
- **Mismo motor que LeBron y Haliburton**: el modelo copia las poses del esqueleto del juego (`rig-glb.js`: pelota en las manos, mates, pases, IK de manos y pies), así que alcanza con que venga riggeado (esqueleto Mixamo).
- **Comodín**: un archivo sin número (`lebron_james.glb`) vale para cualquier camiseta que no tenga su `_N`. Así quedaron LeBron (`phi/`) y los Warriors (Curry, Draymond, Melton, Podziemski, Richard). Haliburton pasó a `ind/tyrese_haliburton/…_1` a `_4` (antes `haliburton_icon/association/statement/city`).
- **Memoria**: antes de arrancar se cargan solo los 10 titulares; los suplentes se cargan cuando entran (un instante con el cuerpo de siempre) y lo que nadie usa se libera. Las texturas de más de 2048 px se muestran a 2048 (`MAX_TEX` en `players3d.js`; `0` para no tocarlas).
- **Sacado**: las camisetas 3D giratorias del menú de camisetas (vuelven los dibujos planos) y `assets/uniformes/`. `pacers3d.js` → `players3d.js`.
- Para probar un modelo en los 10 jugadores: `?modelo3d=lebron` (o `curry`, `haliburton`, o la ruta `gsw/stephen_curry/stephen_curry`).
- Si agregás jugadores nuevos en Supabase: `python3 tools/crear_carpetas_jugadores.py archivo.csv` crea las carpetas que falten.


## Novedades v49 — conjuntos en PNG y un solo cuerpo por jugador
- **Conjuntos en PNG:** carpetas `assets/conjuntos/<sigla>/conjunto_<apodo>_<N>/` (30 equipos × 4; ver `assets/conjuntos/LISTA.txt`). Poné adentro el PNG con el mismo nombre que la carpeta, por ejemplo `assets/conjuntos/gsw/conjunto_warriors_1/conjunto_warriors_1.png` (1 Icon · 2 Association · 3 Statement · 4 City). En el paso Camisetas del menú el PNG se ve grande (y crece al pasar el mouse o elegirlo); si no hay PNG queda el dibujo de siempre. `tools/crear_carpetas_conjuntos.py` recrea las carpetas.
- **Nunca se ven los dos cuerpos:** si un jugador tiene modelo 3D (o todavía se está viendo si lo tiene / se está bajando), el cuerpo que arma el juego queda oculto, en el menú y en el partido. Solo se muestra el cuerpo del juego si de verdad no hay modelo.

## Novedades v50 — pantalla de carga y barra de tiro con dificultad
- **Pantalla de carga** (`boot.js` + `assets/loading.jpg`): al abrir el juego se ve la cancha con una barra que avanza por MB bajados, y dice "MORENO GAMES" chiquito abajo a la derecha. Baja por adelantado la pelota, las canchas 3D, los escudos, la imagen del menú, los planteles y los modelos 3D de los jugadores, así en el menú de equipos Curry y compañía ya están. Si tarda más de 25 s aparece "Entrar igual".
- La lista de lo que se baja está en `assets/manifest.json`. Se regenera con `python3 tools/crear_manifiesto.py` (por defecto: la camiseta de número más bajo de cada jugador + las otras si pesan menos de 8 MB; con `--todo`, todo). Si agregás un GLB y no regenerás, el juego igual lo carga cuando lo necesita; solo que no cuenta en la barra de carga.
- **Barra de tiro con dificultad** (`chargeTarget` en `main.js`): la barra corre más rápido = es más difícil soltar en la línea blanca.
  - Triple: base ×1.28 más rápida que un tiro normal.
  - Rating de la zona (triple / media / cerca): 99 → ~×0.77, 70 → ×1, 40 → ~×1.24. Mejor tirador = barra más lenta.
  - Defensor encima: hasta +45 % de velocidad; sin nadie cerca, sin recargo. Cansado: +10 %.
  - Tiros libres: base ×1.10 y depende del rating de tiro libre (90 → ×0.99, 50 → ×1.22).
  - Los números están todos juntos en esa función para ajustarlos fácil. Online: el invitado calcula la velocidad de su propia barra con la misma regla.

## Novedades v51 — cinemática de inicio
- **Intro** (`intro.js`, sobre la pantalla de carga): la cancha se va ampliando con una cámara que se acerca al aro; entra corriendo un jugador-sombra con una corona dorada, salta y la clava. En el impacto hay flash, anillo de luz, chispas, temblor de cámara y aparece **MORENO GAMES** en grande, con la corona cayendo sobre el título. Es todo 2D (canvas + CSS): no descarga nada y arranca en el primer cuadro.
- Cuando todo terminó de cargar y la cinemática llegó al título, aparece "PRESIONÁ CUALQUIER TECLA PARA JUGAR" (teclado, clic o cualquier botón del joystick). Hasta entonces la barra de carga sigue abajo.
- Cualquier tecla o clic **durante** la cinemática la salta y va directo al título. Mientras la pantalla está, ninguna tecla llega al juego.
- Con "reducir movimiento" activado en el sistema operativo, va directo al título.
- Los tiempos están arriba de `intro.js` (`T_RUN`, `T_IMPACT`, `T_TITLE`, `T_CROWN`, `T_DONE`, `Z_END` = zoom final).


## Novedades v52 — juego más liviano (una estrella por equipo)
- **Jugadores 3D:** se borraron todas las carpetas de `assets/jugadores/` salvo las de las estrellas que tienen modelo: **Curry** (gsw, camisetas 1 a 4), **Haliburton** (ind, 1 a 4) y **LeBron** (phi, solo la 2). Los demás jugadores usan el cuerpo que genera el juego (`rig.js`).
- **Una estrella por equipo:** la tabla `STARS` de `players3d.js` dice cuál es la estrella de cada uno de los 30 equipos. Solo ellos buscan modelo 3D (el resto ni consulta al servidor). Para sumar una: crear `assets/jugadores/<equipo>/<nombre_apellido>/` y copiar ahí `<nombre_apellido>_1.glb` a `_4.glb` (1 Icon · 2 Association · 3 Statement · 4 City).
- **Uniformes por código:** se borró `assets/conjuntos/` (PNG). El menú dibuja las camisetas con SVG (`kits.js`). Los 4 modelos de Haliburton y Curry se mantienen como los 4 conjuntos de esos equipos.
- Se borraron `LISTA.txt`, `LEEME.txt` y las herramientas `crear_carpetas_jugadores.py` y `crear_carpetas_conjuntos.py`. `assets/manifest.json` se regeneró con `python3 tools/crear_manifiesto.py`.
- Canchas 3D (gsw, lal, sas, hou, cha), pelota, escudos y menú: sin cambios.


## Novedades v53 — sin modelos de jugadores + cinemática más fluida
- **Se borraron todos los modelos 3D de jugadores** (`assets/jugadores/`, incluidos Curry, Haliburton y LeBron): todos usan el cuerpo que genera el juego (`rig.js`) y los uniformes se dibujan por código. `STARS` en `players3d.js` quedó vacío, así que el juego no consulta al servidor por modelos. Para volver a usarlos: copiar el GLB a `assets/jugadores/<equipo>/<nombre_apellido>/` y agregar al jugador en `STARS`.
- **Cinemática de inicio más fluida:**
  - El juego (`main.js`) ya no se arma mientras suena la cinemática: `boot.js` lo arranca recién cuando la cinemática llega al título. Los módulos se bajan y compilan antes en paralelo (`modulepreload`), y los archivos (pelota, canchas, escudos) siguen bajándose durante la animación.
  - La silueta usa un solo pase de brillo y solo sobre el recuadro del jugador (antes eran dos pases sobre toda la imagen); el canvas es de 1536×864 fijo.
  - Cámara con `translate3d` (sin `calc()`), barra de carga que se repinta una vez por cuadro, y el título sin desenfoque animado (el brillo se repite 2 veces en lugar de infinito).
- Si preferís que el juego empiece a armarse antes (menos espera después del título, pero más tirones en la cinemática), se cambia en `boot.js` el momento en que se llama a `startGame()`.


## Novedades v54 — ULTIMATE TEAM (nuevo modo)
Menú principal → **Ultimate Team**. Todo el código está en la carpeta `ultimate/`.

**Pestañas** (con **LB / RB** o **Q / E** se cambia de una a otra):
- **Inicio**: portada con tu mejor carta, evento de la semana (Torneo Élite), tu plantilla, sobres destacados, objetivos diarios y los 4 modos.
- **Objetivos**: diarios (3 al día), semanales y hitos. Se reclaman a mano.
- **Jugar**: **Rookie Battles** (10 etapas con estrellas), **Dream Live** (División 10→1, 30 puntos por división, premios de la semana por victorias), **All-Star Live** (entrada 2.000, hasta 10 partidos, termina a la 3.ª derrota, premios por victorias) y **Squad Battles** (4 niveles de rival, puntos y premios semanales). Los partidos son el 3D de siempre: tu plantilla de cartas contra un rival armado con cartas reales.
- **Tienda**: Pack Rookie, Oro, Élite y Especial (con gemas), con la **apertura 3D** del proyecto de sobres (walkout desde 86+ con la cancha real del equipo). Los sobres ganados quedan en "Mis sobres".
- **Mercado**: comprar (filtros por nombre, posición, equipo, media y precio; el stock y los precios cambian por día), vender (precio entre 70 % y 125 % del valor; cuanto más caro, más tarda; 5 % de comisión; dura 12 h) y venta rápida desde la ficha.
- **Plantilla**: cancha con los 5 titulares + banco de 8, colección con filtros, **Autoarmar**, penalización por jugar fuera de posición y ficha de cada carta con los atributos 2K.
- **Mi cuenta**: nombre del club, camiseta y cancha del club (cualquiera de los 30 equipos), duración del cuarto, estadísticas, progreso de colección.

**Cartas ↔ jugadores de la base** (`ultimate/ut-data.js`): cada carta se enlaza con un jugador de la tabla `players` (por `ut_cards.player_id` y, si no está, por equipo + apellido, con tolerancia a errores de OCR). Del jugador salen nombre, número, altura, peso, piel, pelo, accesorios y los atributos 2K; la **media de la carta manda** (los atributos se corren la diferencia). Si no hay jugador en la base, se estiman desde la media y la posición.

**Supabase**: corré `supabase/007_ultimate_team.sql` (después del 002). Crea `ut_cards` (524 cartas + enlace), `ut_saves` (progreso por usuario) y la vista `ut_cartas` para revisar el enlace. Sin cuenta o sin correr el SQL, todo funciona igual y se guarda en el navegador.

**Archivos nuevos:** `ultimate/ut.js` (pantallas) · `ut-state.js` (reglas: economía, sobres, mercado, objetivos, modos, guardado) · `ut-data.js` (cartas, rarezas, enlace con la base) · `ut-match.js` (puente con el partido 3D) · `packs3d.js` + `court3d.js` (apertura de sobres) · `ut.css` · `cards/` (524 webp) · `data/players.js`.
**Tocados:** `index.html`, `ui.js` (item del menú), `main.js` (`openUltimate`), `gamepad.js` (joystick en Ultimate Team).

**Ojo:** no pude abrirlo en un navegador (sin internet para Three.js/Supabase). Probé con scripts la lógica (sobres, mercado, plantilla, modos, recompensas, enlace carta↔jugador con un plantel de prueba) y que las 7 pestañas y todos los modales se generen sin errores. Si algo se ve o se siente raro, decime cuál.

## Ultimate Team · mercado online (008)
- Con cuenta (y Supabase configurado) el MERCADO es entre jugadores reales: publicás cartas a tu precio (entre la mitad de su valor y su valor máximo: una 85 hasta 25.000, Wembanyama hasta 500.000, hasta 20 a la vez, duran 3 días), otros las compran, cobrás el precio menos 5 %. Lo no vendido vuelve a tu colección.
- Correr `supabase/008_mercado_online.sql` en el SQL Editor (usa tablas propias `utm_*`, no choca con el 007).
- Invitados / sin Supabase: sigue el mercado simulado de siempre.


## Novedades v61 — público en los partidos, All-Star nuevo y Dream Live con rachas
**Ambiente de estadio (`crowd.js`)** — suena en TODOS los partidos 3D (casual, online, carrera, Ultimate Team), no en entrenamiento. Todo se genera por código (Web Audio), no baja nada:
- Murmullo de gente + rumor de tribuna; sube cuando el partido está parejo y en el 4.º cuarto.
- Festejo con aplausos y "wooo" cuando anotás o tapás; "awww" cuando anota el rival; "ooooh" cuando el tiro pega en el aro y no entra; abucheo si tu equipo comete violación de 24 s; silencio en los tiros libres.
- **"DE-FENSE, DE-FENSE"** con aplausos y pisadas cuando el rival tiene la pelota un rato (más seguido si el partido está cerrado o vas perdiendo).
- Bocina al final de cada cuarto.
- Volumen en **Configuración → Volumen del público**. Al pausar se calla.
- Sonidos reales opcionales: ver `assets/audio/LEEME.txt` (crowd_loop, cheer, cheer_big, ooh, groan, boo, defense, horn).

**Ultimate Team · All-Star Live (nuevo formato)**
- Entrada: **10.000 monedas**.
- **Clasificatoria**: hasta 5 partidos en **Difícil**; con **2 victorias** pasás (apenas llegás a 2 ya clasificás). Si no, perdés la entrada y te llevás 1.000 monedas de consuelo.
- **Fase final**: **10 partidos en Extremo** (se juegan los 10) y **cada victoria da un premio**, cada vez mejor (monedas y sobres; la 10.ª: 15.000 monedas + sobre Especial). Los premios están en `ALLSTAR.rewards` (`ultimate/ut-state.js`).
- Un torneo viejo en curso se cancela y devuelve los 5.000 de la entrada anterior.

**Ultimate Team · Dream Live (ascensos y descensos estilo FC)**
- Cada división es de **15 puntos** (antes 30). Victoria +3, derrota −2.
- **Racha**: 2 victorias seguidas = ×2 puntos, 4 seguidas = ×3. Una derrota corta la racha. La pantalla muestra tu racha y cuánto vale la próxima victoria.
- **Ascenso** al llegar a 15 (te quedan los puntos que sobran, mínimo 4 de colchón). **Descenso** si bajás de 0 (empezás la división de abajo con 8 puntos). La División 10 no baja.
- Todos los números están juntos en `DREAM` (`ultimate/ut-state.js`). Las divisiones ya empezadas se pasan a la nueva escala (puntos ÷ 2).

## v61 (2.ª tanda) — monedas por partido y pantallas nuevas
- **Todo partido de Ultimate Team paga monedas**: 500 por terminarlo y 700 si lo ganás (`MATCH_PAY` en `ultimate/ut-state.js`). Abandonar no paga. Los premios de cada modo se suman encima (ascensos, etapas Rookie por primera vez, premio de nivel de Squad Battles, premios del All-Star). Se sacaron las monedas chicas que pagaban antes Dream Live, Rookie repetido y Squad al perder, porque ahora las cubre este pago.
- **All-Star Live**: pantalla nueva con las dos etapas lado a lado (círculos ✓/✕ por partido), la regla de cada una, qué pasa si clasificás o no, y la escalera de premios de las 10 victorias. Premios mejorados (suman ~58.000 monedas más sobres) y nuevo **premio por clasificar** (2.000) y **consuelo** (2.500). En `ALLSTAR`.
- **Dream Live**: pantalla nueva con la barra de puntos (zona de descenso / ascenso), la escalera de divisiones 10→1, "si ganás / si perdés" con el resultado exacto, la racha actual y un panel "Cómo funciona".
