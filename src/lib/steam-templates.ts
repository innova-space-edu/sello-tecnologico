export type SteamRoute = 'scientific' | 'engineering' | 'digital' | 'ai_data' | 'mathematical' | 'creative_social'

export type SteamEvidenceRequirement = {
  key: string
  phase: number
  label: string
  type: 'foto' | 'video' | 'documento' | 'código' | 'enlace' | 'presentación'
  required?: boolean
  version?: number
}

export type SteamTemplate = {
  slug: string
  title: string
  icon: string
  areas: string[]
  mode: 'Físico' | 'Digital' | 'Híbrido'
  route: SteamRoute
  levels: string[]
  difficulty: 'Inicial' | 'Intermedia' | 'Avanzada'
  duration: string
  summary: string
  guidingQuestion: string
  product: string
  materials: string[]
  tests: string[]
  evidence: SteamEvidenceRequirement[]
}

export const ROUTE_LABELS: Record<SteamRoute, string> = {
  scientific: 'Investigación científica',
  engineering: 'Ingeniería y prototipo',
  digital: 'Producto digital',
  ai_data: 'Inteligencia artificial y datos',
  mathematical: 'Matemática y modelación',
  creative_social: 'Creación, arte o intervención',
}

export const STEAM_PHASES = [
  { number: 1, key: 'challenge', title: 'Nuestro desafío', icon: '🎯', help: 'Define con claridad qué investigarás, crearás o solucionarás.' },
  { number: 2, key: 'research', title: 'Investigación', icon: '🔎', help: 'Busca antecedentes confiables y comprende los conceptos necesarios.' },
  { number: 3, key: 'design', title: 'Plan y diseño', icon: '✏️', help: 'Planifica, dibuja y revisa la seguridad antes de comenzar.' },
  { number: 4, key: 'version_one', title: 'Primera versión', icon: '🛠️', help: 'Construye, programa, experimenta o produce tu primer resultado.' },
  { number: 5, key: 'testing', title: 'Pruebas y evaluación', icon: '📊', help: 'Prueba tu resultado, registra datos y detecta qué debe mejorar.' },
  { number: 6, key: 'feedback', title: 'Retroalimentación', icon: '💬', help: 'Solicita opiniones útiles y decide cuáles aplicarás.' },
  { number: 7, key: 'version_two', title: 'Versión mejorada', icon: '🚀', help: 'Aplica mejoras y demuestra la diferencia entre ambas versiones.' },
  { number: 8, key: 'closing', title: 'Resultado final', icon: '🏁', help: 'Concluye, reflexiona y prepara el informe y la publicación.' },
] as const

export const PHASE_PROMPTS: Record<SteamRoute, Record<number, string[]>> = {
  scientific: {
    1: ['¿Qué fenómeno quieres investigar?', '¿Cuál es tu pregunta investigable?', '¿Por qué es importante estudiarlo?', '¿Qué resultado esperas obtener?'],
    2: ['¿Qué conceptos científicos necesitas comprender?', '¿Qué estudios o experiencias similares encontraste?', 'Registra al menos tres fuentes confiables.', '¿Qué aprendiste de la investigación?'],
    3: ['Escribe tu hipótesis.', 'Define variable independiente, dependiente y variables controladas.', 'Describe materiales y procedimiento replicable.', 'Identifica riesgos y medidas de seguridad.'],
    4: ['Describe cómo realizaste el experimento.', '¿Qué condiciones mantuviste controladas?', '¿Cuántas repeticiones realizaste?', '¿Qué observaste inicialmente?'],
    5: ['Registra y organiza tus datos.', '¿Qué patrones muestran las tablas o gráficos?', '¿La evidencia apoya tu hipótesis?', '¿Qué errores o limitaciones encontraste?'],
    6: ['¿Qué aspecto quieres que revisen tus compañeros?', 'Resume la retroalimentación recibida.', '¿Qué sugerencias aplicarás y por qué?', '¿Qué sugerencias no aplicarás?'],
    7: ['¿Qué cambiaste en el procedimiento?', '¿Qué nueva prueba realizaste?', 'Compara los resultados de ambas versiones.', '¿La confiabilidad de los resultados mejoró?'],
    8: ['Escribe la conclusión basada en datos.', '¿Se cumplió el objetivo?', '¿Cuáles fueron las limitaciones?', '¿Cómo continuarías esta investigación?'],
  },
  engineering: {
    1: ['¿Qué necesidad resolverá tu prototipo?', '¿Quién lo utilizará?', '¿Qué debe ser capaz de hacer?', '¿Cómo sabrás que funciona?'],
    2: ['¿Qué principios científicos explican su funcionamiento?', '¿Qué soluciones similares existen?', 'Registra al menos tres fuentes confiables.', '¿Qué aprendiste de ellas?'],
    3: ['Define requisitos y restricciones.', 'Compara al menos dos ideas de solución.', 'Describe materiales, presupuesto y plan de construcción.', 'Identifica riesgos y medidas de seguridad.'],
    4: ['Describe cómo construiste la versión 1.', '¿Qué cambios hiciste respecto del boceto?', '¿Qué funcionó inicialmente?', '¿Qué problemas aparecieron?'],
    5: ['Define las pruebas y criterios de éxito.', 'Registra resultados medibles.', '¿Qué falló o funcionó parcialmente?', '¿Qué debe mejorar?'],
    6: ['¿Qué quieres que evalúe la comunidad?', 'Resume fortalezas y sugerencias recibidas.', '¿Qué sugerencias aplicarás?', 'Justifica tus decisiones.'],
    7: ['Enumera los cambios aplicados.', 'Describe la versión 2.', 'Repite las pruebas.', 'Compara los resultados con la versión 1.'],
    8: ['¿El prototipo resolvió la necesidad?', '¿Qué evidencia lo demuestra?', '¿Qué limitaciones conserva?', '¿Cuál sería la próxima mejora?'],
  },
  digital: {
    1: ['¿Qué problema resolverá el producto digital?', '¿Quiénes serán sus usuarios?', '¿Qué tarea facilitará?', '¿Cómo medirás si resulta útil?'],
    2: ['¿Qué aplicaciones similares existen?', '¿Qué tecnologías podrías utilizar?', 'Registra al menos tres fuentes.', '¿Qué necesidades tienen los usuarios?'],
    3: ['Define funciones mínimas.', 'Describe el mapa de navegación.', 'Prepara bocetos de las pantallas.', 'Explica cómo protegerás los datos y la privacidad.'],
    4: ['¿Qué funciones tiene la primera versión?', '¿Qué herramientas utilizaste?', '¿Qué falta por implementar?', 'Agrega enlace, código o capturas.'],
    5: ['¿Qué tareas probaron los usuarios?', 'Registra errores y tiempos.', '¿Qué fue difícil de comprender?', '¿Qué cambios son prioritarios?'],
    6: ['¿Qué deseas que prueben tus compañeros?', 'Resume los comentarios.', 'Selecciona mejoras.', 'Justifica las decisiones.'],
    7: ['¿Qué errores corregiste?', '¿Qué funciones mejoraste?', 'Repite las pruebas de usuario.', 'Compara versión 1 y 2.'],
    8: ['¿El producto cumple su propósito?', '¿Qué resultados lo demuestran?', '¿Qué limitaciones posee?', 'Prepara el tutorial y la publicación.'],
  },
  ai_data: {
    1: ['¿Qué problema abordarás con datos o IA?', '¿Por qué es apropiado usar IA?', '¿Quién se beneficiará?', '¿Cómo medirás el desempeño?'],
    2: ['¿De dónde provendrán los datos?', '¿Tienes autorización para utilizarlos?', '¿Qué modelos o soluciones similares existen?', 'Registra fuentes confiables.'],
    3: ['Define categorías y datos de entrenamiento.', 'Separa entrenamiento y prueba.', 'Define métricas.', 'Analiza privacidad y posibles sesgos.'],
    4: ['Describe el primer conjunto de datos.', 'Entrena la versión 1.', 'Registra configuración y resultados.', 'Agrega capturas o enlace al modelo.'],
    5: ['Calcula aciertos y errores.', 'Registra falsos positivos y negativos.', 'Prueba datos nuevos.', '¿Dónde falla el modelo?'],
    6: ['¿Qué resultados quieres que revisen?', '¿Qué sesgos detectaron?', '¿Qué sugerencias aplicarás?', '¿Cómo mejorarás los datos?'],
    7: ['Mejora los datos o el modelo.', 'Entrena nuevamente.', 'Repite las métricas.', 'Compara ambas versiones.'],
    8: ['¿Cuándo funciona y cuándo no?', '¿Qué precisión alcanzó?', '¿Qué riesgos o límites tiene?', 'Explica el uso responsable.'],
  },
  mathematical: {
    1: ['¿Qué situación real modelarás?', '¿Qué pregunta responderás?', '¿Qué variables intervienen?', '¿Qué resultado esperas?'],
    2: ['¿Qué conceptos matemáticos utilizarás?', '¿Qué datos necesitas?', '¿Qué modelos similares encontraste?', 'Registra tus fuentes.'],
    3: ['Define variables y supuestos.', 'Selecciona fórmulas o métodos.', 'Planifica la recolección de datos.', 'Explica las limitaciones del modelo.'],
    4: ['Construye el primer modelo.', 'Registra cálculos y datos.', 'Crea una primera representación.', '¿Qué predicción produce?'],
    5: ['Compara el modelo con datos reales.', 'Calcula el error.', 'Interpreta gráficos.', '¿Qué supuesto debe cambiar?'],
    6: ['Solicita revisión de cálculos e interpretación.', 'Resume observaciones.', 'Selecciona cambios.', 'Justifica tus decisiones.'],
    7: ['Ajusta el modelo.', 'Repite cálculos.', 'Compara el error.', 'Explica por qué mejoró o no mejoró.'],
    8: ['Responde la pregunta inicial.', 'Explica el alcance del modelo.', 'Indica sus limitaciones.', 'Presenta resultados comprensibles.'],
  },
  creative_social: {
    1: ['¿Qué tema, necesidad o mensaje abordarás?', '¿A qué público se dirige?', '¿Qué reacción o cambio buscas?', '¿Cómo evaluarás su efecto?'],
    2: ['Investiga el contexto.', 'Busca referentes artísticos, históricos o sociales.', 'Registra fuentes.', '¿Qué aprendiste del público?'],
    3: ['Define concepto y lenguaje.', 'Prepara guion, storyboard o boceto.', 'Planifica materiales y tareas.', 'Revisa permisos, derechos y privacidad.'],
    4: ['Crea la primera versión.', 'Describe decisiones creativas.', 'Registra el proceso.', 'Agrega fotografías, audio o video.'],
    5: ['Prueba la obra o intervención con público.', '¿Se comprendió el mensaje?', 'Registra respuestas.', '¿Qué debe mejorar?'],
    6: ['Solicita retroalimentación guiada.', 'Resume fortalezas y dudas.', 'Selecciona sugerencias.', 'Justifica tus decisiones.'],
    7: ['Modifica la propuesta.', 'Explica los cambios.', 'Vuelve a probarla.', 'Compara ambas respuestas.'],
    8: ['¿Lograste el efecto esperado?', '¿Qué evidencia lo demuestra?', '¿Qué aprendiste?', 'Prepara la presentación pública.'],
  },
}

const commonEvidence = (kind: 'physical' | 'digital' | 'research' | 'creative'): SteamEvidenceRequirement[] => {
  if (kind === 'research') return [
    { key: 'research-notes', phase: 2, label: 'Fuentes o notas de investigación', type: 'documento', required: true },
    { key: 'procedure', phase: 3, label: 'Diseño del procedimiento', type: 'documento', required: true },
    { key: 'experiment-v1', phase: 4, label: 'Registro del experimento', type: 'foto', required: true, version: 1 },
    { key: 'results-v1', phase: 5, label: 'Tabla o gráfico de resultados', type: 'documento', required: true, version: 1 },
    { key: 'results-v2', phase: 7, label: 'Resultados mejorados', type: 'documento', required: true, version: 2 },
  ]
  if (kind === 'digital') return [
    { key: 'wireframe', phase: 3, label: 'Boceto de pantallas', type: 'foto', required: true },
    { key: 'digital-v1', phase: 4, label: 'Capturas, código o enlace de la versión 1', type: 'código', required: true, version: 1 },
    { key: 'user-test', phase: 5, label: 'Registro de prueba con usuarios', type: 'documento', required: true, version: 1 },
    { key: 'digital-v2', phase: 7, label: 'Versión digital mejorada', type: 'enlace', required: true, version: 2 },
  ]
  if (kind === 'creative') return [
    { key: 'storyboard', phase: 3, label: 'Boceto, guion o storyboard', type: 'foto', required: true },
    { key: 'creative-v1', phase: 4, label: 'Primera versión de la obra', type: 'foto', required: true, version: 1 },
    { key: 'audience-test', phase: 5, label: 'Registro de respuesta del público', type: 'video', required: true, version: 1 },
    { key: 'creative-v2', phase: 7, label: 'Obra o intervención mejorada', type: 'video', required: true, version: 2 },
  ]
  return [
    { key: 'sketch', phase: 3, label: 'Boceto o plano inicial', type: 'foto', required: true },
    { key: 'prototype-v1', phase: 4, label: 'Prototipo versión 1', type: 'foto', required: true, version: 1 },
    { key: 'test-v1', phase: 5, label: 'Video o registro de pruebas', type: 'video', required: true, version: 1 },
    { key: 'prototype-v2', phase: 7, label: 'Prototipo versión 2', type: 'foto', required: true, version: 2 },
  ]
}

const t = (template: Omit<SteamTemplate, 'evidence'> & { kind: 'physical' | 'digital' | 'research' | 'creative' }): SteamTemplate => {
  const { kind, ...rest } = template
  return { ...rest, evidence: commonEvidence(kind) }
}

export const STEAM_TEMPLATES: SteamTemplate[] = [
  t({ slug: 'germinacion-condiciones', title: 'Germinación bajo distintas condiciones', icon: '🌱', areas: ['Biología','Matemática'], mode: 'Híbrido', route: 'scientific', levels: ['1° medio','2° medio'], difficulty: 'Inicial', duration: '3 semanas', summary: 'Investiga cómo luz, agua, salinidad o temperatura afectan la germinación.', guidingQuestion: '¿Cómo afecta una condición ambiental al porcentaje y tiempo de germinación?', product: 'Experimento con datos, gráficos y conclusión', materials: ['Semillas','Recipientes','Regla'], tests: ['Porcentaje de germinación','Tiempo promedio','Crecimiento'], kind: 'research' }),
  t({ slug: 'biodiversidad-escolar', title: 'Mapa de biodiversidad escolar', icon: '🦋', areas: ['Biología','Geografía','Datos'], mode: 'Híbrido', route: 'scientific', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Registra especies del entorno y compara la diversidad entre sectores.', guidingQuestion: '¿Qué sectores del colegio presentan mayor diversidad biológica y por qué?', product: 'Mapa digital y análisis de biodiversidad', materials: ['Teléfono o cámara','Planilla'], tests: ['Número de especies','Frecuencia','Comparación por zona'], kind: 'research' }),
  t({ slug: 'ritmo-cardiaco-ejercicio', title: 'Ritmo cardíaco y ejercicio', icon: '❤️', areas: ['Biología','Educación Física','Estadística'], mode: 'Híbrido', route: 'scientific', levels: ['1° medio','2° medio'], difficulty: 'Inicial', duration: '2 semanas', summary: 'Compara la respuesta cardíaca ante actividades de distinta intensidad.', guidingQuestion: '¿Cómo cambia el ritmo cardíaco según la intensidad del ejercicio?', product: 'Informe científico con gráficos', materials: ['Cronómetro','Planilla'], tests: ['Pulso en reposo','Pulso posterior','Recuperación'], kind: 'research' }),
  t({ slug: 'corrosion-metales', title: 'Corrosión y protección de metales', icon: '⚗️', areas: ['Química','Tecnología'], mode: 'Híbrido', route: 'scientific', levels: ['1° medio','2° medio','3° medio'], difficulty: 'Intermedia', duration: '3 semanas', summary: 'Compara cómo el agua, la sal y los recubrimientos afectan la corrosión.', guidingQuestion: '¿Qué condición acelera la corrosión y qué recubrimiento protege mejor?', product: 'Experimento comparativo y propuesta protectora', materials: ['Clavos','Recipientes','Agua y sal'], tests: ['Cambio de masa o aspecto','Tiempo','Comparación visual'], kind: 'research' }),
  t({ slug: 'indicadores-ph', title: 'Indicadores naturales de pH', icon: '🧪', areas: ['Química','Artes'], mode: 'Físico', route: 'scientific', levels: ['1° medio','2° medio'], difficulty: 'Inicial', duration: '2 semanas', summary: 'Crea una escala de color usando un indicador vegetal y sustancias escolares seguras.', guidingQuestion: '¿Podemos clasificar sustancias cotidianas mediante un indicador natural?', product: 'Escala cromática de pH y reporte', materials: ['Indicador vegetal','Vasos','Sustancias seguras'], tests: ['Color observado','Repetibilidad','Clasificación'], kind: 'research' }),
  t({ slug: 'contaminacion-luminica', title: 'Mapa de contaminación lumínica', icon: '🌌', areas: ['Astronomía','Física','Geografía'], mode: 'Híbrido', route: 'scientific', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Mide el brillo del cielo y relaciona resultados con iluminación y ubicación.', guidingQuestion: '¿Cómo cambia la visibilidad del cielo según el lugar y la iluminación?', product: 'Mapa nocturno y recomendaciones', materials: ['Teléfono','Mapa','Planilla'], tests: ['Estrellas visibles','Brillo estimado','Comparación por zona'], kind: 'research' }),
  t({ slug: 'crateres-impacto', title: 'Cráteres de impacto', icon: '☄️', areas: ['Astronomía','Física','Matemática'], mode: 'Físico', route: 'scientific', levels: ['1° medio','2° medio'], difficulty: 'Inicial', duration: '2 semanas', summary: 'Modela cómo altura, masa y superficie modifican un cráter.', guidingQuestion: '¿Cómo influye la energía del impacto en el diámetro del cráter?', product: 'Modelo experimental con mediciones', materials: ['Bandeja','Harina o arena','Esferas'], tests: ['Diámetro','Profundidad','Altura de caída'], kind: 'research' }),
  t({ slug: 'captador-niebla', title: 'Captador de niebla a escala', icon: '💧', areas: ['Agua','Física','Ingeniería'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Compara mallas, ángulos y superficies para optimizar la captación.', guidingQuestion: '¿Qué diseño captura más agua bajo las mismas condiciones?', product: 'Prototipo de captador y comparación de diseños', materials: ['Mallas','Marco','Recipiente'], tests: ['Volumen captado','Tiempo','Estabilidad'], kind: 'physical' }),
  t({ slug: 'riego-automatico', title: 'Riego automático eficiente', icon: '🚿', areas: ['Agricultura','Electrónica','Programación'], mode: 'Híbrido', route: 'engineering', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Avanzada', duration: '6 semanas', summary: 'Activa el riego según humedad y compara el consumo con un sistema manual.', guidingQuestion: '¿Cómo reducir el consumo de agua manteniendo una humedad adecuada?', product: 'Sistema de riego controlado', materials: ['Sensor de humedad','Microcontrolador','Bomba de baja tensión'], tests: ['Humedad','Agua utilizada','Tiempo de respuesta'], kind: 'physical' }),
  t({ slug: 'puente-resistente', title: 'Puente resistente con material limitado', icon: '🌉', areas: ['Física','Ingeniería','Matemática'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio','3° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Diseña un puente liviano que soporte la mayor carga posible.', guidingQuestion: '¿Qué geometría ofrece la mejor relación entre masa y resistencia?', product: 'Puente probado y mejorado', materials: ['Papel, madera liviana o palitos','Adhesivo'], tests: ['Carga máxima','Masa','Deformación'], kind: 'physical' }),
  t({ slug: 'casa-antisismica', title: 'Casa antisísmica', icon: '🏠', areas: ['Física','Ingeniería','Diseño'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '5 semanas', summary: 'Construye y mejora una estructura sometida a vibraciones controladas.', guidingQuestion: '¿Qué diseño estructural resiste mejor una vibración simulada?', product: 'Maqueta antisísmica con pruebas', materials: ['Materiales livianos','Base vibratoria manual'], tests: ['Estabilidad','Daño','Tiempo de resistencia'], kind: 'physical' }),
  t({ slug: 'horno-solar', title: 'Horno solar eficiente', icon: '☀️', areas: ['Física','Energía','Ingeniería'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio','3° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Compara aislantes, reflectores y geometrías para alcanzar mayor temperatura.', guidingQuestion: '¿Qué combinación de diseño y materiales aprovecha mejor la energía solar?', product: 'Horno solar a escala, sin consumo de preparaciones experimentales', materials: ['Cartón','Reflectante','Aislante','Termómetro'], tests: ['Temperatura máxima','Tiempo','Pérdida térmica'], kind: 'physical' }),
  t({ slug: 'planeador-optimizado', title: 'Planeador optimizado', icon: '✈️', areas: ['Aeroespacial','Física','Matemática'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio','3° medio'], difficulty: 'Intermedia', duration: '3 semanas', summary: 'Modifica ala, masa y centro de gravedad para mejorar el vuelo.', guidingQuestion: '¿Qué configuración permite un vuelo más estable y prolongado?', product: 'Planeador versión 1 y 2', materials: ['Cartón liviano o espuma','Regla','Balanza'], tests: ['Distancia','Tiempo de vuelo','Desviación'], kind: 'physical' }),
  t({ slug: 'rover-marciano', title: 'Rover para terreno marciano', icon: '🤖', areas: ['Aeroespacial','Robótica','Física'], mode: 'Híbrido', route: 'engineering', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Avanzada', duration: '8 semanas', summary: 'Diseña un vehículo que supere arena, pendientes y obstáculos.', guidingQuestion: '¿Qué sistema de tracción permite recorrer mejor un terreno irregular?', product: 'Rover funcional con telemetría básica', materials: ['Kit robótico','Motores','Sensores'], tests: ['Distancia','Pendiente','Obstáculos','Carga'], kind: 'physical' }),
  t({ slug: 'cubesat-escolar', title: 'Misión CubeSat escolar', icon: '🛰️', areas: ['Espacio','Electrónica','Diseño'], mode: 'Híbrido', route: 'engineering', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Avanzada', duration: '8 semanas', summary: 'Diseña una misión y distribuye energía, sensores y comunicaciones en un volumen limitado.', guidingQuestion: '¿Cómo diseñar un CubeSat capaz de cumplir una misión de observación?', product: 'Modelo CubeSat y panel de misión', materials: ['Materiales de maqueta','Sensores opcionales'], tests: ['Volumen','Masa','Energía simulada','Telemetría'], kind: 'physical' }),
  t({ slug: 'mano-robotica', title: 'Mano robótica articulada', icon: '🦾', areas: ['Biología','Ingeniería','Diseño'], mode: 'Físico', route: 'engineering', levels: ['1° medio','2° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Modela huesos, articulaciones y tendones mediante un mecanismo controlable.', guidingQuestion: '¿Cómo reproducir el movimiento básico de una mano con materiales simples?', product: 'Mano articulada capaz de sujetar objetos', materials: ['Cartón','Hilo','Tubos flexibles'], tests: ['Rango de movimiento','Objetos sujetados','Fuerza'], kind: 'physical' }),
  t({ slug: 'app-habitos-estudio', title: 'Aplicación de hábitos de estudio', icon: '📱', areas: ['Programación','Orientación','Diseño'], mode: 'Digital', route: 'digital', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '6 semanas', summary: 'Crea una herramienta de planificación y seguimiento sin recopilar datos sensibles.', guidingQuestion: '¿Cómo ayudar a organizar el estudio de manera simple y respetuosa de la privacidad?', product: 'Aplicación o sitio web funcional', materials: ['Computador'], tests: ['Tareas completadas','Errores','Comprensión del usuario'], kind: 'digital' }),
  t({ slug: 'videojuego-educativo', title: 'Videojuego educativo', icon: '🎮', areas: ['Programación','Arte','Asignatura elegida'], mode: 'Digital', route: 'digital', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '7 semanas', summary: 'Enseña un contenido mediante mecánicas, decisiones y retroalimentación.', guidingQuestion: '¿Cómo puede un videojuego ayudar a aprender un contenido específico?', product: 'Videojuego jugable y evaluado', materials: ['Computador'], tests: ['Jugabilidad','Aprendizaje','Errores'], kind: 'digital' }),
  t({ slug: 'museo-virtual', title: 'Museo virtual interactivo', icon: '🏛️', areas: ['Historia','Arte','Tecnología'], mode: 'Digital', route: 'digital', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '6 semanas', summary: 'Organiza objetos, relatos y recursos multimedia en una experiencia navegable.', guidingQuestion: '¿Cómo comunicar un patrimonio o tema mediante una experiencia digital?', product: 'Museo web o recorrido virtual', materials: ['Computador','Fuentes autorizadas'], tests: ['Navegación','Comprensión','Accesibilidad'], kind: 'digital' }),
  t({ slug: 'simulador-sistema-solar', title: 'Simulador del sistema solar', icon: '🪐', areas: ['Astronomía','Programación','Matemática'], mode: 'Digital', route: 'digital', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Avanzada', duration: '7 semanas', summary: 'Representa órbitas, escalas y periodos mediante una simulación interactiva.', guidingQuestion: '¿Cómo representar relaciones orbitales sin perder claridad por las enormes escalas?', product: 'Simulador interactivo', materials: ['Computador'], tests: ['Exactitud','Controles','Comprensión'], kind: 'digital' }),
  t({ slug: 'clasificador-residuos-ia', title: 'Clasificador de residuos con IA', icon: '♻️', areas: ['IA','Tecnología','Ambiente'], mode: 'Digital', route: 'ai_data', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Avanzada', duration: '7 semanas', summary: 'Entrena un modelo de imágenes y estudia sus errores y sesgos.', guidingQuestion: '¿Con qué precisión puede un modelo escolar clasificar residuos comunes?', product: 'Modelo entrenado y evaluación ética', materials: ['Computador','Imágenes autorizadas'], tests: ['Precisión','Falsos positivos','Datos nuevos'], kind: 'digital' }),
  t({ slug: 'ia-movimientos', title: 'IA que reconoce movimientos', icon: '🏃', areas: ['IA','Educación Física','Programación'], mode: 'Híbrido', route: 'ai_data', levels: ['1° medio','2° medio','3° medio'], difficulty: 'Intermedia', duration: '5 semanas', summary: 'Recolecta datos de movimiento, entrena un modelo y mejora su precisión.', guidingQuestion: '¿Cómo influyen la cantidad y diversidad de datos en el reconocimiento de movimientos?', product: 'Modelo de movimiento conectado a una respuesta digital o física', materials: ['Micro:bit o herramienta web','Computador'], tests: ['Precisión','Confusión entre clases','Datos nuevos'], kind: 'digital' }),
  t({ slug: 'detector-desinformacion', title: 'Detector guiado de desinformación', icon: '📰', areas: ['IA','Lenguaje','Ciudadanía'], mode: 'Digital', route: 'ai_data', levels: ['3° medio','4° medio'], difficulty: 'Avanzada', duration: '6 semanas', summary: 'Clasifica señales de confiabilidad sin reemplazar la verificación humana.', guidingQuestion: '¿Qué indicadores ayudan a detectar información dudosa y cuáles producen errores?', product: 'Herramienta explicable de verificación', materials: ['Computador','Conjunto de ejemplos'], tests: ['Precisión','Explicabilidad','Casos ambiguos'], kind: 'digital' }),
  t({ slug: 'modelo-transito-escolar', title: 'Modelo del tránsito escolar', icon: '🚦', areas: ['Matemática','Estadística','Ciudadanía'], mode: 'Híbrido', route: 'mathematical', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '5 semanas', summary: 'Mide flujos, identifica momentos críticos y simula alternativas.', guidingQuestion: '¿Cómo reorganizar el flujo de entrada o salida usando datos?', product: 'Modelo matemático y propuesta visual', materials: ['Planilla','Cronómetro'], tests: ['Flujo por minuto','Tiempo de espera','Error del modelo'], kind: 'research' }),
  t({ slug: 'optimizacion-envases', title: 'Optimización de envases', icon: '📦', areas: ['Matemática','Diseño','Ingeniería'], mode: 'Híbrido', route: 'mathematical', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Maximiza volumen o resistencia usando una cantidad limitada de material.', guidingQuestion: '¿Qué forma utiliza mejor el material disponible?', product: 'Modelo matemático y prototipo de envase', materials: ['Cartulina','Regla','Planilla'], tests: ['Volumen','Área utilizada','Resistencia'], kind: 'physical' }),
  t({ slug: 'maquina-galton', title: 'Máquina de Galton y probabilidad', icon: '🔢', areas: ['Probabilidad','Física','Diseño'], mode: 'Híbrido', route: 'mathematical', levels: ['3° medio','4° medio'], difficulty: 'Intermedia', duration: '4 semanas', summary: 'Construye una máquina y compara la distribución experimental con la teórica.', guidingQuestion: '¿Cuándo aparece una distribución aproximadamente normal y qué factores la alteran?', product: 'Máquina, datos y simulación', materials: ['Tablero','Clavos o separadores','Esferas'], tests: ['Frecuencias','Simetría','Error respecto del modelo'], kind: 'physical' }),
  t({ slug: 'mural-realidad-aumentada', title: 'Mural con realidad aumentada', icon: '🎨', areas: ['Artes','Tecnología','Comunicación'], mode: 'Híbrido', route: 'creative_social', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '6 semanas', summary: 'Conecta una obra física con audio, animación o información digital.', guidingQuestion: '¿Cómo ampliar el mensaje de una obra física mediante contenidos digitales?', product: 'Mural y experiencia aumentada', materials: ['Materiales artísticos','Dispositivo digital'], tests: ['Comprensión','Interacción','Accesibilidad'], kind: 'creative' }),
  t({ slug: 'podcast-cientifico', title: 'Podcast de divulgación científica', icon: '🎙️', areas: ['Ciencias','Lenguaje','Audio'], mode: 'Digital', route: 'creative_social', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Inicial', duration: '4 semanas', summary: 'Investiga y explica un tema científico mediante una producción sonora rigurosa.', guidingQuestion: '¿Cómo explicar un tema complejo de manera clara, interesante y basada en evidencia?', product: 'Episodio publicado con fuentes', materials: ['Teléfono o micrófono','Editor de audio'], tests: ['Comprensión','Calidad de fuentes','Calidad sonora'], kind: 'creative' }),
  t({ slug: 'documental-cientifico', title: 'Documental científico local', icon: '🎬', areas: ['Ciencias','Arte','Lenguaje'], mode: 'Híbrido', route: 'creative_social', levels: ['2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '7 semanas', summary: 'Investiga un fenómeno o actividad local y comunícalo con imágenes y evidencia.', guidingQuestion: '¿Cómo contar una historia científica local sin perder rigor?', product: 'Documental breve con bibliografía', materials: ['Cámara o teléfono','Editor de video'], tests: ['Comprensión','Rigor','Respuesta del público'], kind: 'creative' }),
  t({ slug: 'ruta-patrimonial-qr', title: 'Ruta patrimonial con QR', icon: '🗺️', areas: ['Historia','Geografía','Tecnología'], mode: 'Híbrido', route: 'creative_social', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '6 semanas', summary: 'Relaciona lugares físicos con relatos, fuentes y recursos multimedia.', guidingQuestion: '¿Cómo hacer visible y comprensible un patrimonio de la comunidad?', product: 'Ruta física y sitio digital', materials: ['Códigos QR','Fuentes históricas'], tests: ['Exactitud','Navegación','Interés del público'], kind: 'creative' }),
  t({ slug: 'accesibilidad-colegio', title: 'Mapa y soluciones de accesibilidad', icon: '♿', areas: ['Ciudadanía','Diseño','Tecnología'], mode: 'Híbrido', route: 'creative_social', levels: ['1° medio','2° medio','3° medio','4° medio'], difficulty: 'Intermedia', duration: '6 semanas', summary: 'Identifica barreras y diseña mejoras con participación y respeto.', guidingQuestion: '¿Qué barreras dificultan la participación y qué soluciones son viables?', product: 'Mapa, prototipo y propuesta', materials: ['Plano','Instrumentos de medición'], tests: ['Barreras identificadas','Opinión de usuarios','Viabilidad'], kind: 'creative' }),
]

export function getSteamTemplate(slug: string | null | undefined) {
  return STEAM_TEMPLATES.find(template => template.slug === slug) ?? null
}
