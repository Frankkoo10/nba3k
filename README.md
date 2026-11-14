# Basket 3D — v27

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

**Estado:** esta es la **etapa 1** (salas, lobby, menú sincronizado en vivo y "todo listo"). Todavía **no corre el partido sincronizado**: al empezar aparece una pantalla de "¡Todo listo!" con los dos equipos. `PM.getSetup()` ya devuelve el partido armado para online (anfitrión = Local, invitado = Visitante) y el canal `sala:<id>` ya existe, listo para la **etapa 2** (mandar movimientos, pelota y marcador).

**Archivos:** `online.js` (lobby, salas, canal en vivo) · `prematch.js` (modo online del menú previo) · `supabase/004_salas_online.sql` · `ui.js`/`main.js`/`index.html`/`gamepad.js`/`style.css` (conexiones y estilos).
