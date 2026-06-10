import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

// En Next.js en desarrollo el módulo se recarga — evitar múltiples conexiones
const globalForDb = globalThis as unknown as { db: ReturnType<typeof postgres> }

export const db = globalForDb.db || postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') globalForDb.db = db
