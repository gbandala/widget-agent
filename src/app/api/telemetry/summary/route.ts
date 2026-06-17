import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.TELEMETRY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [services, securitySummary, topAttackers, lastAccepted, visits, widgetSessions, contacts] =
    await Promise.all([
      // Service events last 7 days
      db`
        SELECT monitor,
               count(*)::int                                                 AS total_events,
               sum(case when status = 'down' then 1 else 0 end)::int        AS downs,
               round(avg(latency_ms))::int                                  AS avg_latency_ms,
               max(ts)                                                       AS last_event
        FROM telemetry.t_service_events
        WHERE ts > now() - interval '7 days'
        GROUP BY monitor
        ORDER BY downs DESC
      `,

      // SSH/Tailscale last 48h summary
      db`
        SELECT channel, result, count(*)::int AS events
        FROM telemetry.t_access_events
        WHERE ts > now() - interval '2 days'
        GROUP BY channel, result
        ORDER BY events DESC
      `,

      // Top attackers last 48h
      db`
        SELECT ip, count(*)::int AS attempts
        FROM telemetry.t_access_events
        WHERE channel = 'ssh' AND result = 'failed'
          AND ts > now() - interval '2 days'
          AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY attempts DESC
        LIMIT 5
      `,

      // Last accepted accesses
      db`
        SELECT channel, ip, ts
        FROM telemetry.t_access_events
        WHERE result = 'accepted'
        ORDER BY ts DESC
        LIMIT 5
      `,

      // Visit sessions last 7 days
      db`
        SELECT
          count(*)::int                                                              AS total_sessions,
          round(avg(extract(epoch from (ts_end - ts_start)) / 60.0), 1)::float     AS avg_dwell_min,
          (
            SELECT s->>'section'
            FROM telemetry.t_visit_sessions vs2,
                 jsonb_array_elements(sections_seen) s
            WHERE vs2.ts_start > now() - interval '7 days'
            GROUP BY s->>'section'
            ORDER BY count(*) DESC
            LIMIT 1
          ) AS top_section
        FROM telemetry.t_visit_sessions
        WHERE ts_start > now() - interval '7 days'
          AND ts_end IS NOT NULL
      `,

      // Widget sessions last 7 days
      db`
        SELECT
          count(*)::int                                                    AS total_sessions,
          count(DISTINCT anon_id)::int                                     AS unique_visitors,
          sum(case when lead_id is not null then 1 else 0 end)::int        AS with_lead
        FROM widget_sessions
        WHERE started_at > now() - interval '7 days'
      `,

      // Recent contacts
      db`
        SELECT nombre, empresa, etapa, bant_score, created_at
        FROM contacts
        WHERE created_at > now() - interval '7 days'
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ])

  type SecurityRow = { channel: string; result: string; events: number }
  const secRows = securitySummary as unknown as SecurityRow[]

  const failedSSH = secRows
    .filter(r => r.channel === 'ssh' && r.result === 'failed')
    .reduce((acc, r) => acc + Number(r.events), 0)

  const acceptedSSH = secRows
    .filter(r => r.channel === 'ssh' && r.result === 'accepted')
    .reduce((acc, r) => acc + Number(r.events), 0)

  return NextResponse.json({
    ts: new Date().toISOString(),
    services: services.map((s: Record<string, unknown>) => ({
      monitor: s.monitor,
      downs: s.downs ?? 0,
      totalEvents: s.total_events ?? 0,
      avgLatencyMs: s.avg_latency_ms ?? null,
      lastEvent: s.last_event,
    })),
    security: {
      failedSSH_48h: failedSSH,
      acceptedSSH_48h: acceptedSSH,
      topAttackers: topAttackers.map((r: Record<string, unknown>) => ({ ip: r.ip, attempts: r.attempts })),
      lastAccepted: lastAccepted.map((r: Record<string, unknown>) => ({ channel: r.channel, ip: r.ip, ts: r.ts })),
    },
    visits: {
      sessions_7d: visits[0]?.total_sessions ?? 0,
      avgDwellMin: visits[0]?.avg_dwell_min ?? null,
      topSection: visits[0]?.top_section ?? null,
    },
    widget: {
      sessions_7d: widgetSessions[0]?.total_sessions ?? 0,
      uniqueVisitors: widgetSessions[0]?.unique_visitors ?? 0,
      withLead: widgetSessions[0]?.with_lead ?? 0,
    },
    contacts: {
      new_7d: contacts.length,
      list: contacts.map((c: Record<string, unknown>) => ({
        nombre: c.nombre,
        empresa: c.empresa,
        etapa: c.etapa,
        score: c.bant_score,
        createdAt: c.created_at,
      })),
    },
  })
}
