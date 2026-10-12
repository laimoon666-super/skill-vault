// Host half of the @local/dsh-token-stats plugin.
//
// Folds per-model token usage from every session log the host can see
// (live-preferred reads through the unified session query service), caches
// per-session folds keyed by the persistence revision so unchanged persisted
// logs are never re-read, and serves the aggregate to the browser panel at
// GET /api/token-stats/stats.
//
// The first request pays one full scan; later requests re-read only live
// sessions plus persisted logs whose revision changed. `?force=1` bypasses
// the revision cache. Usage attribution follows the shipped convention: the
// latest `request/header` (or `request/context`) names the provider/model in
// effect, and each `assistant/message` carrying `usage` adds its TokenUsage
// to that route, bucketed by the event's own timestamp in local time. Session
// titles are folded from the same log pass (`session/title` events), so no
// extra reads are needed.

export const name = '@local/dsh-token-stats'
export const inject = []

const API_PATH = '/api/token-stats/stats'
const READ_CONCURRENCY = 4
const TITLE_MAX_CHARS = 90

/** Local-timezone `YYYY-MM-DD` key for one Unix epoch millisecond value. */
function localDateKey(ms) {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Fresh aggregate bucket. Short keys keep the wire payload compact. */
function emptyTotals() {
  return { i: 0, o: 0, cr: 0, cw: 0, r: 0, c: 0 }
}

/** Add one provider TokenUsage report into a bucket (one model call). */
function addUsage(bucket, usage) {
  bucket.i += num(usage.inputTokens)
  bucket.o += num(usage.outputTokens)
  bucket.cr += num(usage.cacheReadTokens)
  bucket.cw += num(usage.cacheWriteTokens)
  bucket.r += num(usage.reasoningTokens)
  bucket.c += 1
}

/** Sum one already-aggregated bucket into another. */
function addTotals(target, source) {
  target.i += source.i
  target.o += source.o
  target.cr += source.cr
  target.cw += source.cw
  target.r += source.r
  target.c += source.c
}

/** Coerce an optional usage counter to a finite non-negative number. */
function num(value) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Truncate a session title for the wire. */
function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Fold one full session log snapshot into a per-session usage record.
 * @returns the record, or null when the log carries no token usage.
 */
function foldLog(snapshot) {
  let provider = 'unknown'
  let model = 'unknown'
  let title
  let lastUsedAt = 0
  let usageCount = 0
  const days = {}
  const totals = emptyTotals()
  for (const event of snapshot.events) {
    const data = event.data
    if (data === null || typeof data !== 'object') continue
    if (event.type === 'request/header') {
      const config = data.header?.config
      if (typeof config?.provider === 'string' && config.provider !== '') {
        provider = config.provider
        model = typeof config.model === 'string' && config.model !== '' ? config.model : 'unknown'
      }
    } else if (event.type === 'request/context') {
      if (typeof data.provider === 'string' && data.provider !== '') {
        provider = data.provider
        model = typeof data.model === 'string' && data.model !== '' ? data.model : 'unknown'
      }
    } else if (event.type === 'session/title') {
      if (typeof data.title === 'string' && data.title !== '') title = data.title
    } else if (event.type === 'assistant/message') {
      const usage = data.usage
      if (usage === null || typeof usage !== 'object') continue
      const dayKey = localDateKey(event.time)
      const day = days[dayKey] ?? (days[dayKey] = {})
      const byModel = day[provider] ?? (day[provider] = {})
      const bucket = byModel[model] ?? (byModel[model] = emptyTotals())
      addUsage(bucket, usage)
      addUsage(totals, usage)
      if (event.time > lastUsedAt) lastUsedAt = event.time
      usageCount += 1
    }
  }
  if (usageCount === 0) return null
  return { days, totals, lastUsedAt, title, usageCount }
}

/** Deep-merge one session's per-day buckets into the corpus-level byDay map. */
function mergeDays(target, days) {
  if (days === undefined) return
  for (const [dayKey, byProvider] of Object.entries(days)) {
    const day = target[dayKey] ?? (target[dayKey] = {})
    for (const [provider, byModel] of Object.entries(byProvider)) {
      const targetProvider = day[provider] ?? (day[provider] = {})
      for (const [model, totals] of Object.entries(byModel)) {
        const bucket = targetProvider[model] ?? (targetProvider[model] = emptyTotals())
        addTotals(bucket, totals)
      }
    }
  }
}

/** Run async jobs with bounded concurrency, preserving input order of results. */
async function runPool(jobs, concurrency) {
  let index = 0
  const size = Math.max(1, Math.min(concurrency, jobs.length))
  const worker = async () => {
    while (index < jobs.length) {
      const job = jobs[index]
      index += 1
      await job()
    }
  }
  await Promise.all(Array.from({ length: size }, worker))
}

/**
 * Scan machinery owned by one activation of the session-query services.
 */
function createCore(scope, logger) {
  const sessionQuery = scope.sessionQuery
  const sessionPersistence = scope.sessionPersistence
  /** Per-session fold cache: id -> { fp, fold } (persisted sessions only). */
  const cache = new Map()
  let inFlight = null

  const doScan = async (force) => {
    const records = await sessionQuery.listSessions()
    // Cheap change tokens for persisted logs, so unchanged sessions are never
    // decompressed again. Any failure falls back to re-reading everything.
    const revisions = new Map()
    try {
      const snapshots = await sessionPersistence.list()
      for (const snapshot of snapshots) revisions.set(snapshot.header.id, String(snapshot.revision))
    } catch (error) {
      logger.warn(`token-stats: persistence revision listing failed, re-reading all logs: ${String(error?.message ?? error)}`)
    }

    const byDay = {}
    const sessions = []
    let errors = 0
    let usageSessions = 0

    const jobs = records.map((record) => async () => {
      const id = record.header.id
      try {
        let fold
        if (record.live) {
          // Live sessions are in-memory and always re-read; they carry no
          // usable revision token between flushes.
          fold = foldLog(await sessionQuery.readSession(id))
        } else {
          const fp = revisions.get(id) ?? `persisted:${record.header.createdAt}`
          const hit = cache.get(id)
          if (!force && hit !== undefined && hit.fp === fp) {
            fold = hit.fold
          } else {
            fold = foldLog(await sessionQuery.readSession(id))
            cache.set(id, { fp, fold })
          }
        }
        if (fold === null) return
        usageSessions += 1
        mergeDays(byDay, fold.days)
        sessions.push({
          id,
          ...(fold.title !== undefined ? { title: truncate(fold.title, TITLE_MAX_CHARS) } : {}),
          createdAt: record.header.createdAt,
          lastUsedAt: fold.lastUsedAt,
          ...(record.header.cwd !== undefined ? { cwd: record.header.cwd } : {}),
          ...(record.header.origin !== undefined ? { origin: record.header.origin } : {}),
          ...(record.header.parentSession !== undefined ? { parent: record.header.parentSession } : {}),
          live: record.live,
          days: fold.days,
          totals: fold.totals,
        })
      } catch (error) {
        errors += 1
        logger.warn(`token-stats: session ${id} skipped: ${String(error?.message ?? error)}`)
      }
    })
    await runPool(jobs, READ_CONCURRENCY)

    sessions.sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    return {
      generatedAt: Date.now(),
      sessionCount: records.length,
      usageSessions,
      errors,
      byDay,
      sessions,
    }
  }

  return {
    /** One serialized scan; concurrent callers share the same result. */
    scan(force) {
      if (inFlight !== null) return inFlight
      const run = doScan(force === true).finally(() => {
        inFlight = null
      })
      inFlight = run
      return run
    },
  }
}

/**
 * Loopback trust fence copied from the community route convention: the Host
 * header must name a loopback authority, Sec-Fetch-Site must not be
 * cross-site, and a present Origin must match the Host.
 */
function isTrustedRequest(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== '[::1]' && hostUrl.hostname !== '::1') return false
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/**
 * Plugin body. The scan core and the HTTP route ride separate scoped
 * injects: the route answers 503 until the session services are up, and a
 * composition without a webServer simply never mounts the route.
 * @param ctx - host root context.
 */
export function apply(ctx) {
  const state = { core: null, providers: [] }

  ctx.inject(['sessionQuery', 'sessionPersistence'], (scope) => {
    state.core = createCore(scope, ctx.logger)
    return () => {
      state.core = null
    }
  })

  // Optional provider display names for nicer model labels in the panel.
  ctx.inject(['llm'], (scope) => {
    try {
      state.providers = scope.llm.listProviders().map((entry) => ({ id: entry.id, name: entry.name }))
    } catch {
      state.providers = []
    }
    return () => {
      state.providers = []
    }
  })

  ctx.inject(['webServer'], (scope) => {
    scope.webServer.register({
      name: 'token-stats',
      kind: 'exact',
      path: API_PATH,
      handler: async (req, res) => {
        const send = (status, body) => {
          res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'GET') {
          send(405, { ok: false, error: 'method not allowed' })
          return
        }
        if (!isTrustedRequest(req)) {
          send(403, { ok: false, error: 'forbidden: loopback only' })
          return
        }
        const core = state.core
        if (core === null) {
          send(503, { ok: false, error: 'session query services not ready' })
          return
        }
        try {
          const url = new URL(req.url, 'http://localhost')
          const force = url.searchParams.get('force') === '1'
          const doc = await core.scan(force)
          send(200, {
            ok: true,
            providers: state.providers,
            ...doc,
          })
        } catch (error) {
          send(500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    })
  })
}
