/**
 * Scope Guard — Valida que el mensaje del usuario sea relevante
 * a los servicios de la consultoría antes de enviarlo al modelo.
 *
 * Estrategia: validación ligera por keywords para no añadir latencia.
 * El modelo también tiene instrucciones de scope en su system prompt.
 */

const OUT_OF_SCOPE_PATTERNS = [
  // Política / noticias
  /\b(política|presidente|elecciones?|partido|gobierno)\b/i,
  // Medicina
  /\b(enfermedad|síntoma|diagnóstico|medicamento|pastilla|dosis|médico)\b/i,
  // Finanzas personales fuera de contexto tech
  /\b(bitcoin|cripto|inversión|bolsa de valores|acciones|forex)\b/i,
  // Contenido inapropiado
  /\b(sexo|pornografía|violencia|hack|explotar|vulnerabilidad|ddos)\b/i,
  // Competidores / comparativas no relacionadas
  /\b(dios|religión|filosofía existencial)\b/i,
]

const IN_SCOPE_BOOST_PATTERNS = [
  /\b(software|aplicación|app|web|sistema|plataforma|desarrollo|programar)\b/i,
  /\b(consultoría|proyecto|servicio|cotización|precio|costo|propuesta)\b/i,
  /\b(ia|inteligencia artificial|chatbot|automatización|integración)\b/i,
  /\b(cita|agenda|reunión|llamada|demo|presentación)\b/i,
  /\b(equipo|tecnología|stack|backend|frontend|base de datos)\b/i,
  /\b(presupuesto|contrato|propuesta|inicio|empezar|trabajar)\b/i,
]

export interface ScopeResult {
  allowed: boolean
  reason?: string
}

/**
 * Verifica si el mensaje está dentro del scope del widget.
 * Retorna { allowed: true } si pasa, o { allowed: false, reason } si no.
 */
export function checkScope(message: string): ScopeResult {
  // Mensajes muy cortos (saludos, etc.) siempre pasan
  if (message.trim().length < 15) {
    return { allowed: true }
  }

  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        allowed: false,
        reason: 'off_topic',
      }
    }
  }

  // Si el mensaje tiene señales positivas del scope, pasa sin duda
  for (const pattern of IN_SCOPE_BOOST_PATTERNS) {
    if (pattern.test(message)) {
      return { allowed: true }
    }
  }

  // Mensajes ambiguos: dejar pasar y dejar que el modelo maneje el scope
  return { allowed: true }
}

/**
 * Respuesta cordial cuando el mensaje está fuera de scope.
 */
export const SCOPE_DECLINE_MESSAGE =
  'Entiendo tu consulta, pero mi especialidad es ayudarte con información sobre nuestros servicios de consultoría tecnológica, proyectos de software e inteligencia artificial. ¿Hay algo en lo que pueda orientarte en ese sentido?'
