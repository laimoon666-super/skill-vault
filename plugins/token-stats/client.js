// Browser half of the @local/dsh-token-stats plugin, hand-written in the
// lazy-CJS bundle protocol (window.__ModuleLoader__.load), so no build step
// and no imports from dsh client packages.
//
// It contributes one main panel ("token-stats") with a sidebar entry: a
// token-usage statistics page fed by the host route
// GET /api/token-stats/stats. The host folds every session log into
// per-day / per-provider / per-model buckets plus a per-session breakdown;
// this page applies all time filtering client-side, so switching between
// 今日 / 近7天 / 近30天 / 自定义 is instant.

window.__ModuleLoader__.load({
  id: '@local/dsh-token-stats',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = (function () {
      try {
        return require('react')
      } catch (error) {
        console.error('[token-stats] react unavailable, panel skipped: ' + error)
        return null
      }
    })()
    if (React === null) return module.exports

    var NS = 'token-stats'
    var PANEL_ID = 'token-stats'
    var API_PATH = 'api/token-stats/stats'

    var dict = {
      zh: {
        'panel': 'Token 统计',
        'title': 'Token 用量统计',
        'subtitle': '按模型统计全部会话的 token 消耗',
        'range.today': '今日',
        'range.week': '近 7 天',
        'range.month': '近 30 天',
        'range.all': '全部',
        'range.custom': '自定义',
        'range.from': '开始',
        'range.to': '结束',
        'action.refresh': '刷新',
        'action.refreshing': '统计中…',
        'summary.billedInput': '计费输入',
        'summary.output': '输出',
        'summary.cacheRead': '缓存读',
        'summary.cacheWrite': '缓存写',
        'summary.reasoning': '思考',
        'summary.calls': '模型调用',
        'summary.sessions': '使用会话',
        'trend.title': '每日用量',
        'trend.total': '总量',
        'models.title': '模型分布',
        'models.model': '模型',
        'models.calls': '调用',
        'models.share': '占比',
        'sessions.title': '会话排行',
        'sessions.session': '会话',
        'sessions.models': '模型',
        'sessions.lastUsed': '最近使用',
        'sessions.subagent': '子代理',
        'sessions.empty': '所选时间范围内没有用量',
        'state.loading': '正在扫描全部会话日志…',
        'state.empty': '暂无数据',
        'state.error': '加载失败',
        'note.cached': '秒前更新',
        'note.force': '已重新扫描',
      },
      en: {
        'panel': 'Token Stats',
        'title': 'Token Usage',
        'subtitle': 'Per-model token consumption across all sessions',
        'range.today': 'Today',
        'range.week': 'Last 7 days',
        'range.month': 'Last 30 days',
        'range.all': 'All',
        'range.custom': 'Custom',
        'range.from': 'From',
        'range.to': 'To',
        'action.refresh': 'Refresh',
        'action.refreshing': 'Scanning…',
        'summary.billedInput': 'Billed input',
        'summary.output': 'Output',
        'summary.cacheRead': 'Cache read',
        'summary.cacheWrite': 'Cache write',
        'summary.reasoning': 'Reasoning',
        'summary.calls': 'Model calls',
        'summary.sessions': 'Sessions',
        'trend.title': 'Daily usage',
        'trend.total': 'Total',
        'models.title': 'By model',
        'models.model': 'Model',
        'models.calls': 'Calls',
        'models.share': 'Share',
        'sessions.title': 'Top sessions',
        'sessions.session': 'Session',
        'sessions.models': 'Models',
        'sessions.lastUsed': 'Last used',
        'sessions.subagent': 'subagent',
        'sessions.empty': 'No usage in the selected range',
        'state.loading': 'Scanning all session logs…',
        'state.empty': 'No data',
        'state.error': 'Load failed',
        'note.cached': 's ago',
        'note.force': 'Rescanned',
      },
    }

    // ------------------------------------------------------------------
    // formatting helpers
    // ------------------------------------------------------------------

    function fmtCount(value) {
      if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
      if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'
      if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K'
      return String(value)
    }

    function fmtPercent(value) {
      return (value * 100).toFixed(1) + '%'
    }

    function fmtDate(ms) {
      var d = new Date(ms)
      var mm = String(d.getMonth() + 1).padStart(2, '0')
      var dd = String(d.getDate()).padStart(2, '0')
      return d.getFullYear() + '-' + mm + '-' + dd
    }

    function fmtDateTime(ms) {
      var d = new Date(ms)
      var hh = String(d.getHours()).padStart(2, '0')
      var mi = String(d.getMinutes()).padStart(2, '0')
      return fmtDate(ms) + ' ' + hh + ':' + mi
    }

    function todayKey() {
      return fmtDate(Date.now())
    }

    function daysAgoKey(n) {
      return fmtDate(Date.now() - n * 86400000)
    }

    function totalsOf(bucket) {
      return {
        i: bucket.i || 0,
        o: bucket.o || 0,
        cr: bucket.cr || 0,
        cw: bucket.cw || 0,
        r: bucket.r || 0,
        c: bucket.c || 0,
      }
    }

    function sumBuckets(buckets) {
      var out = totalsOf({})
      for (var i = 0; i < buckets.length; i++) addInto(out, buckets[i])
      return out
    }

    function addInto(target, source) {
      target.i += source.i || 0
      target.o += source.o || 0
      target.cr += source.cr || 0
      target.cw += source.cw || 0
      target.r += source.r || 0
      target.c += source.c || 0
    }

    function billedInput(t) {
      return t.i + t.cr + t.cw
    }

    function grandTotal(t) {
      return t.i + t.o + t.cr + t.cw + t.r
    }

    // ------------------------------------------------------------------
    // aggregation helpers
    // ------------------------------------------------------------------

    function collectDays(byDay, fromKey, toKey) {
      var keys = Object.keys(byDay).sort()
      if (fromKey !== undefined) keys = keys.filter(function (k) { return k >= fromKey })
      if (toKey !== undefined) keys = keys.filter(function (k) { return k <= toKey })
      return keys
    }

    function rangeModels(byDay, keys) {
      var models = {} // "provider/model" -> {provider, model, totals}
      for (var i = 0; i < keys.length; i++) {
        var day = byDay[keys[i]] || {}
        var providers = Object.keys(day)
        for (var p = 0; p < providers.length; p++) {
          var provider = providers[p]
          var entries = Object.keys(day[provider])
          for (var m = 0; m < entries.length; m++) {
            var model = entries[m]
            var key = provider + '/' + model
            var slot = models[key]
            if (slot === undefined) slot = models[key] = { provider: provider, model: model, totals: totalsOf({}) }
            addInto(slot.totals, day[provider][model])
          }
        }
      }
      return models
    }

    function rangeSessions(sessions, keys) {
      var keySet = {}
      for (var i = 0; i < keys.length; i++) keySet[keys[i]] = true
      var out = []
      for (var s = 0; s < sessions.length; s++) {
        var session = sessions[s]
        var totals = totalsOf({})
        var modelKeys = {}
        var dayKeys = Object.keys(session.days || {})
        for (var d = 0; d < dayKeys.length; d++) {
          if (!keySet[dayKeys[d]]) continue
          var day = session.days[dayKeys[d]]
          var providers = Object.keys(day)
          for (var p = 0; p < providers.length; p++) {
            var entries = Object.keys(day[providers[p]])
            for (var m = 0; m < entries.length; m++) {
              addInto(totals, day[providers[p]][entries[m]])
              modelKeys[providers[p] + '/' + entries[m]] = true
            }
          }
        }
        if (totals.c === 0) continue
        out.push({ session: session, totals: totals, models: Object.keys(modelKeys) })
      }
      out.sort(function (a, b) { return grandTotal(b.totals) - grandTotal(a.totals) })
      return out
    }

    // ------------------------------------------------------------------
    // theme-aware style constants (CSS vars with fallbacks)
    // ------------------------------------------------------------------

    var COLOR = {
      bg: 'var(--dsw-alias-bg-base, #fff)',
      layer: 'var(--dsw-alias-bg-layer-1, #fff)',
      layer2: 'var(--dsw-alias-bg-layer-2, #f5f5f5)',
      border: 'var(--dsw-alias-border-l1, rgba(0,0,0,0.1))',
      border2: 'var(--dsw-alias-border-l2, rgba(0,0,0,0.18))',
      text: 'var(--dsw-alias-label-primary, #1f2328)',
      text2: 'var(--dsw-alias-label-secondary, #6a737d)',
      brand: 'var(--dsw-alias-brand-primary, #4d6bfe)',
      accent: '#e8823a',
      bar2: '#3aa981',
      bar3: '#8a6fd6',
    }

    var BAR_COLORS = ['#4d6bfe', '#e8823a', '#3aa981', '#8a6fd6', '#d64f7a', '#c0a83a', '#3aa9c5', '#a05a3a']

    function colorFor(index) {
      return BAR_COLORS[index % BAR_COLORS.length]
    }

    var card = {
      background: COLOR.layer,
      border: '1px solid ' + COLOR.border,
      borderRadius: '10px',
      padding: '14px 16px',
    }

    var tableHead = {
      fontSize: '12px',
      color: COLOR.text2,
      fontWeight: 600,
      textAlign: 'left',
      padding: '6px 10px',
      borderBottom: '1px solid ' + COLOR.border,
      whiteSpace: 'nowrap',
    }

    var tableCell = {
      fontSize: '13px',
      padding: '6px 10px',
      borderBottom: '1px solid ' + COLOR.border,
      whiteSpace: 'nowrap',
    }

    // ------------------------------------------------------------------
    // components
    // ------------------------------------------------------------------

    function h(type, props) {
      for (var _len = arguments.length, children = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        children[_key - 2] = arguments[_key]
      }
      return React.createElement.apply(React, [type, props].concat(children))
    }

    /** Decorative bar-chart glyph for the sidebar panel row. */
    function StatsIcon(_ref) {
      var size = _ref.size || 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block', flex: '0 0 auto' },
        },
        h('rect', { x: '3', y: '12', width: '4', height: '8', rx: '1', fill: 'currentColor', opacity: '0.55' }),
        h('rect', { x: '10', y: '7', width: '4', height: '13', rx: '1', fill: 'currentColor', opacity: '0.8' }),
        h('rect', { x: '17', y: '3', width: '4', height: '17', rx: '1', fill: 'currentColor' })
      )
    }

    function SummaryCard(_ref2) {
      var label = _ref2.label, value = _ref2.value, hint = _ref2.hint, accent = _ref2.accent
      return h(
        'div',
        { style: Object.assign({}, card, { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px', flex: '1 1 0' }) },
        h('div', { style: { fontSize: '12px', color: COLOR.text2 } }, label),
        h(
          'div',
          { style: { fontSize: '20px', fontWeight: 700, color: accent || COLOR.text, fontVariantNumeric: 'tabular-nums' } },
          value
        ),
        hint ? h('div', { style: { fontSize: '11px', color: COLOR.text2 } }, hint) : null
      )
    }

    /** Daily usage bar chart (pure CSS), one bar per day. */
    function TrendChart(_ref3) {
      var t = _ref3.t, dayTotals = _ref3.dayTotals, models = _ref3.models
      var modelList = models.map(function (entry) { return entry.key })
      var max = 0
      for (var i = 0; i < dayTotals.length; i++) max = Math.max(max, grandTotal(dayTotals[i].totals))
      if (max === 0) max = 1
      var shown = dayTotals.slice(-62)
      var skipped = dayTotals.length - shown.length
      return h(
        'div',
        { style: Object.assign({}, card, { display: 'flex', flexDirection: 'column', gap: '10px' }) },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
          h('div', { style: { fontSize: '13px', fontWeight: 600 } }, t('trend.title')),
          h('div', { style: { fontSize: '12px', color: COLOR.text2 } }, t('trend.total') + ' ' + fmtCount(max) + (skipped > 0 ? ' · +' + skipped + 'd' : ''))
        ),
        shown.length === 0
          ? h('div', { style: { color: COLOR.text2, fontSize: '13px' } }, t('sessions.empty'))
          : h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '120px',
              },
            },
            shown.map(function (day) {
              var total = grandTotal(day.totals)
              if (total === 0) {
                return h('div', {
                  key: day.key,
                  title: day.key,
                  style: { flex: '1 1 0', minWidth: '3px', height: '2px', background: COLOR.border, borderRadius: '1px', alignSelf: 'flex-end' },
                })
              }
              // stack per-model segments bottom-up
              var segments = []
              var offset = 0
              for (var m = 0; m < modelList.length; m++) {
                var slot = day.models[modelList[m]]
                if (slot === undefined) continue
                var segTotal = grandTotal(slot)
                var segHeight = Math.round((segTotal / max) * 120)
                if (segHeight === 0) continue
                segments.push(
                  h('div', {
                    key: modelList[m],
                    title: modelList[m] + ' · ' + fmtCount(segTotal),
                    style: {
                      width: '100%',
                      height: segHeight + 'px',
                      background: colorFor(m),
                      borderRadius: offset === 0 ? '3px 3px 0 0' : '0',
                    },
                  })
                )
                offset += segHeight
              }
              return h(
                'div',
                {
                  key: day.key,
                  title: day.key + ' · ' + fmtCount(total),
                  style: {
                    flex: '1 1 0',
                    minWidth: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    height: '120px',
                  },
                },
                segments
              )
            })
          ),
        shown.length > 0
          ? h(
            'div',
            { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: COLOR.text2 } },
            modelList.map(function (key, index) {
              return h(
                'span',
                { key: key, style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
                h('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: colorFor(index), display: 'inline-block' } }),
                key
              )
            })
          )
          : null
      )
    }

    function ModelTable(_ref4) {
      var t = _ref4.t, rows = _ref4.rows, grand = _ref4.grand
      if (rows.length === 0) return null
      return h(
        'div',
        { style: Object.assign({}, card, { display: 'flex', flexDirection: 'column' }) },
        h('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '6px' } }, t('models.title')),
        h(
          'table',
          { style: { borderCollapse: 'collapse', width: '100%' } },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { style: tableHead }, t('models.model')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.billedInput')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.output')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.cacheRead')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.calls')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('models.share'))
            )
          ),
          h(
            'tbody',
            null,
            rows.map(function (row) {
              var share = grand > 0 ? grandTotal(row.totals) / grand : 0
              return h(
                'tr',
                { key: row.key },
                h(
                  'td',
                  { style: Object.assign({}, tableCell, { maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }) },
                  h('span', { style: { fontWeight: 600 } }, row.model), h('span', { style: { color: COLOR.text2 } }, ' · ' + row.provider)
                ),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, fmtCount(billedInput(row.totals))),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, fmtCount(row.totals.o)),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: COLOR.text2 }) }, fmtCount(row.totals.cr)),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, String(row.totals.c)),
                h(
                  'td',
                  { style: Object.assign({}, tableCell, { minWidth: '140px' }) },
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' } },
                    h('span', { style: { fontSize: '11px', color: COLOR.text2, fontVariantNumeric: 'tabular-nums' } }, fmtPercent(share)),
                    h('div', { style: { width: '70px', height: '6px', borderRadius: '3px', background: COLOR.layer2, overflow: 'hidden' } },
                      h('div', { style: { width: fmtPercent(share), height: '100%', background: COLOR.brand, borderRadius: '3px' } }))
                  )
                )
              )
            })
          )
        )
      )
    }

    function SessionTable(_ref5) {
      var t = _ref5.t, rows = _ref5.rows, limit = _ref5.limit === undefined ? 30 : _ref5.limit
      if (rows.length === 0) return null
      return h(
        'div',
        { style: Object.assign({}, card, { display: 'flex', flexDirection: 'column' }) },
        h('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '6px' } }, t('sessions.title')),
        h(
          'table',
          { style: { borderCollapse: 'collapse', width: '100%' } },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { style: tableHead }, t('sessions.session')),
              h('th', { style: tableHead }, t('sessions.models')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.billedInput')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.output')),
              h('th', { style: Object.assign({}, tableHead, { textAlign: 'right' }) }, t('summary.calls')),
              h('th', { style: tableHead }, t('sessions.lastUsed'))
            )
          ),
          h(
            'tbody',
            null,
            rows.slice(0, limit).map(function (row) {
              var session = row.session
              var label = session.title || (session.cwd ? session.cwd.split(/[\\/]/).pop() : session.id.slice(0, 8))
              return h(
                'tr',
                { key: session.id },
                h(
                  'td',
                  { style: Object.assign({}, tableCell, { maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }) },
                  h('span', { title: session.id }, label),
                  session.origin === 'subagent' ? h('span', { style: { fontSize: '11px', color: COLOR.text2, marginLeft: '6px', border: '1px solid ' + COLOR.border2, borderRadius: '4px', padding: '0 4px' } }, t('sessions.subagent')) : null
                ),
                h('td', { style: Object.assign({}, tableCell, { maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', color: COLOR.text2, fontSize: '12px' }) }, row.models.join(', ')),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, fmtCount(billedInput(row.totals))),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, fmtCount(row.totals.o)),
                h('td', { style: Object.assign({}, tableCell, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, String(row.totals.c)),
                h('td', { style: Object.assign({}, tableCell, { color: COLOR.text2, fontSize: '12px' }) }, fmtDateTime(session.lastUsedAt))
              )
            })
          )
        )
      )
    }

    var chipBase = {
      border: '1px solid ' + COLOR.border,
      borderRadius: '999px',
      padding: '3px 12px',
      fontSize: '12px',
      cursor: 'pointer',
      lineHeight: '1.6',
      whiteSpace: 'nowrap',
    }

    /** The statistics main panel. */
    function StatsPage() {
      var _React$useState = React.useState(null),
        doc = _React$useState[0],
        setDoc = _React$useState[1]
      var _React$useState2 = React.useState('today'),
        range = _React$useState2[0],
        setRange = _React$useState2[1]
      var _React$useState3 = React.useState(''),
        from = _React$useState3[0],
        setFrom = _React$useState3[1]
      var _React$useState4 = React.useState(''),
        to = _React$useState4[0],
        setTo = _React$useState4[1]
      var _React$useState5 = React.useState(true),
        loading = _React$useState5[0],
        setLoading = _React$useState5[1]
      var _React$useState6 = React.useState(null),
        error = _React$useState6[0],
        setError = _React$useState6[1]

      var load = React.useCallback(function (force) {
        setLoading(true)
        setError(null)
        var url = API_PATH + (force ? '?force=1' : '')
        fetch(url, { signal: AbortSignal.timeout(120000) })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.json()
          })
          .then(function (body) {
            if (!body || body.ok !== true) throw new Error(body && body.error ? body.error : 'bad response')
            setDoc(body)
            setLoading(false)
          }, function (reason) {
            setError(reason instanceof Error ? reason.message : String(reason))
            setLoading(false)
          })
      }, [])

      React.useEffect(function () {
        load(false)
      }, [load])

      // poll while the panel is open so live sessions appear without a click
      React.useEffect(function () {
        var timer = setInterval(function () {
          load(false)
        }, 30000)
        return function () {
          clearInterval(timer)
        }
      }, [load])

      var locale = 'zh'
      var t = function (key) {
        var table = dict[locale] || dict.zh
        return table[key] || dict.zh[key] || key
      }

      var rangeKeys = []
      var fromKey, toKey
      if (doc) {
        if (range === 'today') {
          fromKey = todayKey()
        } else if (range === 'week') {
          fromKey = daysAgoKey(6)
        } else if (range === 'month') {
          fromKey = daysAgoKey(29)
        } else if (range === 'custom') {
          if (from) fromKey = from
          if (to) toKey = to
        }
        rangeKeys = collectDays(doc.byDay, fromKey, toKey)
      }

      var modelRows = []
      var modelList = []
      var rangeTotals = totalsOf({})
      var dayTotals = []
      var sessionRows = []
      if (doc) {
        var models = rangeModels(doc.byDay, rangeKeys)
        modelRows = Object.keys(models)
          .map(function (key) {
            return { key: key, provider: models[key].provider, model: models[key].model, totals: models[key].totals }
          })
          .sort(function (a, b) { return grandTotal(b.totals) - grandTotal(a.totals) })
        modelList = modelRows
        for (var i = 0; i < rangeKeys.length; i++) {
          var day = doc.byDay[rangeKeys[i]] || {}
          var dayModels = {}
          var daySum = totalsOf({})
          var providers = Object.keys(day)
          for (var p = 0; p < providers.length; p++) {
            var entries = Object.keys(day[providers[p]])
            for (var m = 0; m < entries.length; m++) {
              var key = providers[p] + '/' + entries[m]
              var bucket = totalsOf(day[providers[p]][entries[m]])
              if (dayModels[key] === undefined) dayModels[key] = totalsOf({})
              addInto(dayModels[key], bucket)
              addInto(daySum, bucket)
            }
          }
          dayTotals.push({ key: rangeKeys[i], totals: daySum, models: dayModels })
        }
        rangeTotals = dayTotals.length > 0 ? sumBuckets(dayTotals.map(function (d) { return d.totals })) : totalsOf({})
        sessionRows = rangeSessions(doc.sessions || [], rangeKeys)
      }

      var grand = grandTotal(rangeTotals)

      var chip = function (id, label) {
        return h(
          'button',
          {
            key: id,
            type: 'button',
            onClick: function () { setRange(id) },
            style: Object.assign({}, chipBase, {
              background: range === id ? COLOR.brand : 'transparent',
              color: range === id ? '#fff' : COLOR.text,
              borderColor: range === id ? COLOR.brand : COLOR.border,
            }),
          },
          label
        )
      }

      return h(
        'section',
        {
          'aria-label': t('title'),
          'data-testid': 'token-stats-page',
          style: {
            height: '100%',
            overflowY: 'auto',
            background: COLOR.bg,
            color: COLOR.text,
            display: 'flex',
            flexDirection: 'column',
          },
        },
        h(
          'div',
          { style: { maxWidth: '1080px', width: '100%', margin: '0 auto', padding: '24px 28px 48px', display: 'flex', flexDirection: 'column', gap: '14px' } },
          // heading + controls
          h(
            'div',
            { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' } },
            h(
              'div',
              null,
              h('h1', { style: { fontSize: '20px', fontWeight: 700, margin: 0 } }, t('title')),
              h(
                'div',
                { style: { fontSize: '12px', color: COLOR.text2, marginTop: '4px' } },
                t('subtitle') + (doc ? ' · ' + fmtCount(doc.sessionCount) + ' sessions' + (doc.errors > 0 ? ' · ' + doc.errors + ' skipped' : '') : '')
              )
            ),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h(
                'button',
                {
                  type: 'button',
                  disabled: loading,
                  onClick: function () { load(true) },
                  style: Object.assign({}, chipBase, { borderRadius: '8px', background: COLOR.layer, opacity: loading ? 0.6 : 1 }),
                },
                loading ? t('action.refreshing') : t('action.refresh')
              )
            )
          ),
          // range chips + custom inputs
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
            chip('today', t('range.today')),
            chip('week', t('range.week')),
            chip('month', t('range.month')),
            chip('all', t('range.all')),
            chip('custom', t('range.custom')),
            range === 'custom'
              ? h(
                'span',
                { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: COLOR.text2 } },
                t('range.from'),
                h('input', {
                  type: 'date',
                  value: from,
                  max: to || undefined,
                  onChange: function (event) { setFrom(event.target.value) },
                  style: {
                    border: '1px solid ' + COLOR.border,
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    background: COLOR.layer,
                    color: COLOR.text,
                  },
                }),
                t('range.to'),
                h('input', {
                  type: 'date',
                  value: to,
                  min: from || undefined,
                  onChange: function (event) { setTo(event.target.value) },
                  style: {
                    border: '1px solid ' + COLOR.border,
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    background: COLOR.layer,
                    color: COLOR.text,
                  },
                })
              )
              : null,
            doc
              ? h(
                'span',
                { style: { fontSize: '11px', color: COLOR.text2, marginLeft: 'auto' } },
                t('note.cached').replace('s ago', Math.max(1, Math.round((Date.now() - doc.generatedAt) / 1000)) + 's ago').replace('秒前', Math.max(1, Math.round((Date.now() - doc.generatedAt) / 1000)) + ' 秒前')
              )
              : null
          ),
          // summary cards
          h(
            'div',
            { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            h(SummaryCard, { label: t('summary.billedInput'), value: fmtCount(billedInput(rangeTotals)), hint: 'in ' + fmtCount(rangeTotals.i) + ' + cache ' + fmtCount(rangeTotals.cr + rangeTotals.cw), accent: COLOR.brand }),
            h(SummaryCard, { label: t('summary.output'), value: fmtCount(rangeTotals.o) }),
            h(SummaryCard, { label: t('summary.cacheRead'), value: fmtCount(rangeTotals.cr) }),
            h(SummaryCard, { label: t('summary.cacheWrite'), value: fmtCount(rangeTotals.cw) }),
            h(SummaryCard, { label: t('summary.reasoning'), value: fmtCount(rangeTotals.r) }),
            h(SummaryCard, { label: t('summary.calls'), value: fmtCount(rangeTotals.c) }),
            h(SummaryCard, { label: t('summary.sessions'), value: String(sessionRows.length) })
          ),
          // body
          loading && !doc
            ? h(
              'div',
              { style: Object.assign({}, card, { color: COLOR.text2, fontSize: '13px', textAlign: 'center', padding: '48px 16px' }) },
              t('state.loading')
            )
            : error
              ? h(
                'div',
                { style: Object.assign({}, card, { color: 'var(--dsw-alias-state-error-primary, #d33)', fontSize: '13px' }) },
                t('state.error') + ': ' + error
              )
              : !doc || grand === 0
                ? h(
                  'div',
                  { style: Object.assign({}, card, { color: COLOR.text2, fontSize: '13px', textAlign: 'center', padding: '48px 16px' }) },
                  t('sessions.empty')
                )
                : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
                  h(TrendChart, { t: t, dayTotals: dayTotals, models: modelList }),
                  h(ModelTable, { t: t, rows: modelRows, grand: grand }),
                  h(SessionTable, { t: t, rows: sessionRows })
                )
        )
      )
    }

    /**
     * Client plugin body: registers dictionaries, then the sidebar panel
     * entry and the main panel page. Both slot services ride scoped
     * injects so the plugin degrades to nothing on compositions without
     * them instead of failing to load.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      if (typeof ctx.inject !== 'function') return

      ctx.inject(['locale'], function (scope) {
        try {
          return scope.locale.register(NS, dict)
        } catch (error) {
          console.error('[token-stats] locale registration failed: ' + error)
          return function () {}
        }
      })

      ctx.inject(['slots'], function (scope) {
        var disposers = []
        try {
          disposers.push(
            scope.slots.register(
              {
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: 11,
                label: NS,
                locale: NS,
              },
              StatsIcon
            )
          )
        } catch (error) {
          console.error('[token-stats] sidebar entry failed: ' + error)
        }
        try {
          disposers.push(
            scope.slots.register(
              {
                name: 'main',
                key: PANEL_ID,
                locale: NS,
              },
              StatsPage
            )
          )
        } catch (error) {
          console.error('[token-stats] main panel failed: ' + error)
        }
        return function () {
          for (var i = 0; i < disposers.length; i++) {
            try {
              disposers[i]()
            } catch (error) {
              // slot fiber already gone
            }
          }
        }
      })
    }

    exports.apply = apply
    // `slots` and `locale` are both optional (scoped injects), so no hard deps.
    exports.inject = []
    return module.exports
  },
})
