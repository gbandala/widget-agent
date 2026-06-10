#!/usr/bin/env tsx
/**
 * Widget Agent — Setup CLI
 * Uso: npx tsx scripts/setup.ts
 *
 * Pasos:
 * 1. Valida variables de entorno
 * 2. Aplica las migraciones SQL desde supabase/migrations/
 * 3. Genera el primer widget_token
 * 4. Carga KB inicial desde /supabase/seed/kb.json si existe
 * 5. Muestra resumen de configuración
 */

import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ---- Helpers ----
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

function log(msg: string) { console.log(`\n✓ ${msg}`) }
function warn(msg: string) { console.log(`\n⚠  ${msg}`) }
function error(msg: string) { console.error(`\n✗ ${msg}`) }

// ---- Main ----
async function main() {
  console.log('\n════════════════════════════════════════')
  console.log('     Widget Agent — Setup Inicial')
  console.log('════════════════════════════════════════')

  // 1. Validar env
  const required = [
    'DATABASE_URL',
    'OPENROUTER_API_KEY',
  ]

  // Cargar .env.local si existe
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
    log('.env.local cargado')
  } else {
    warn('No se encontró .env.local — asegúrate de crearlo desde .env.example')
  }

  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    error(`Variables de entorno faltantes: ${missing.join(', ')}`)
    error('Crea .env.local con esas variables y vuelve a ejecutar setup.ts')
    process.exit(1)
  }
  log('Variables de entorno validadas')

  const sql = postgres(process.env.DATABASE_URL!)

  // 2. Aplicar migraciones SQL
  const migrationsDir = path.join(process.cwd(), 'supabase/migrations')
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      try {
        await sql.unsafe(migrationSql)
        log(`Migración aplicada: ${file}`)
      } catch (err) {
        const msg = String(err)
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          warn(`${file}: ya aplicada (skipped)`)
        } else {
          warn(`${file}: ${msg}`)
        }
      }
    }
  } else {
    warn('Directorio supabase/migrations no encontrado. Aplica manualmente.')
  }

  // 3. Configurar bot y generar token
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log('\n──── Configuración del Widget ────')
  const botName = (await ask(rl, 'Nombre del bot (ej: "Sofia"): ')).trim() || 'Asistente'
  const botAvatarUrl = (await ask(rl, 'URL del avatar del bot (Enter para omitir): ')).trim() || null
  const label = (await ask(rl, 'Etiqueta para este token (ej: "Landing principal"): ')).trim() || 'Landing principal'
  const allowedOrigin = (await ask(rl, 'URL de la landing autorizada (ej: https://miempresa.com): ')).trim()

  rl.close()

  if (!allowedOrigin) {
    error('Debes ingresar la URL de la landing autorizada')
    process.exit(1)
  }

  // Insertar token en DB
  const tokenRows = await sql`
    INSERT INTO widget_tokens ${sql({
      label,
      allowed_origin: allowedOrigin,
      bot_name: botName,
      bot_avatar_url: botAvatarUrl,
      is_active: true,
      agent_language: 'es',
      agent_tone: 'profesional',
      agent_use_emojis: true,
      // agent_instructions, agent_scope y welcome_message se configuran desde el panel admin
    })}
    RETURNING *
  `
  const tokenData = tokenRows[0]
  log(`Token creado para "${label}" → ${allowedOrigin}`)

  // 4. Cargar KB seed si existe
  const seedPath = path.join(process.cwd(), 'supabase/seed/kb.json')
  if (fs.existsSync(seedPath)) {
    const entries = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
    try {
      await sql`INSERT INTO kb_entries ${sql(entries)}`
      log(`KB seed cargado: ${entries.length} entradas`)
    } catch (err) {
      warn(`KB seed parcialmente cargado: ${String(err)}`)
    }
  } else {
    warn('No se encontró supabase/seed/kb.json — puedes cargar la KB desde el panel admin')
    // Crear template vacío
    const templatePath = path.join(process.cwd(), 'supabase/seed/kb.example.json')
    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(path.dirname(templatePath), { recursive: true })
      fs.writeFileSync(templatePath, JSON.stringify([
        {
          title: "Ejemplo: Servicio principal",
          content: "Describe aquí tu servicio principal: qué ofreces, a quién va dirigido y cuál es el beneficio clave para el cliente.",
          category: "service",
          tags: ["servicio", "principal"]
        },
        {
          title: "Ejemplo: Pregunta frecuente",
          content: "¿Cómo funciona el proceso de contratación? Aquí puedes describir los pasos típicos desde el primer contacto hasta el inicio del proyecto.",
          category: "faq",
          tags: ["proceso", "contratacion"]
        },
        {
          title: "Ejemplo: Caso de éxito",
          content: "Describe un proyecto representativo: el reto del cliente, la solución implementada y los resultados obtenidos (sin mencionar nombres de clientes).",
          category: "project_case",
          tags: ["caso", "exito", "resultados"]
        }
      ], null, 2))
      log('Template de KB creado en supabase/seed/kb.example.json')
    }
  }

  // 5. Resumen
  console.log('\n════════════════════════════════════════')
  console.log('     Setup Completado ✓')
  console.log('════════════════════════════════════════')
  console.log(`\n  Bot Name:      ${botName}`)
  console.log(`  Token ID:      ${tokenData.id}`)
  console.log(`  Widget Token:  ${tokenData.token}`)
  console.log(`  Origin:        ${allowedOrigin}`)
  console.log('\n  Agrega esto a tu landing:')
  console.log(`\n  <script>`)
  console.log(`    window.WIDGET_TOKEN = "${tokenData.token}";`)
  console.log(`  </script>`)
  console.log(`  <script src="${allowedOrigin || 'http://localhost:3000'}/widget.js" defer></script>`)
  console.log('\n  Panel Admin:   http://localhost:3000/tokens')
  console.log('  (configura la personalidad del agente desde el panel admin)')
  console.log('\n════════════════════════════════════════\n')

  await sql.end()
}

main().catch(e => {
  error(String(e))
  process.exit(1)
})
