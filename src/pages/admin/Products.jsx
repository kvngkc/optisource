import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

// ── Spec labels ───────────────────────────────────────────────
const SPEC_LABELS = {
  sph_add:          'SPH + ADD',
  sph_cyl:          'SPH + CYL',
  sph_cyl_axis_add: 'SPH + CYL + AXIS + ADD',
  name_only:        'Name only',
  base_add:         'Base + ADD',
  base_only:        'Base only',
}

// ── Spec dropdown values ──────────────────────────────────────
const SPH_VALUES = ['Plano',
  ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
]
const CYL_VALUES = ['-', '+000',
  ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]
const AXIS_VALUES = ['-', '90', '180']
const ADD_VALUES  = ['-',
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]
const BASE_VALUES = ['Plano',
  ...Array.from({ length: 12 }, (_, i) => String((i + 1) * 100))
]

// ── Import templates (6 types across 4 groups) ────────────────
const TEMPLATE_GROUPS = [
  {
    group: 'Finished Lenses',
    templates: [
      {
        id: 'finished_sph_add',
        label: 'Finished (SPH + ADD)',
        desc: 'e.g. Bifocal, Photochromic, Progressive',
        spec_type: 'sph_add',
        sphKey: 'sph', sphLabel: 'SPH',
        hasSph: true, hasCyl: false, hasAxis: false, hasAdd: true, isUtility: false,
        csvCols: ['product_name', 'location_code', 'sph', 'addition', 'qty'],
        examples: [
          '1.56 Bifocal,STORE,+200,+100,50',
          '1.56 Bifocal,STORE,+175,+100,30',
          'CR39 Photochromic,SHOP1,Plano,+125,20',
        ],
      },
      {
        id: 'single_vision',
        label: 'Single Vision (SPH + CYL)',
        desc: 'e.g. S/V AR, CR39 SV, 1.56 SV',
        spec_type: 'sph_cyl',
        sphKey: 'sph', sphLabel: 'SPH',
        hasSph: true, hasCyl: true, hasAxis: false, hasAdd: false, isUtility: false,
        csvCols: ['product_name', 'location_code', 'sph', 'cyl', 'qty'],
        examples: [
          'CR39 SV AR,STORE,+200,-025,20',
          'CR39 SV AR,STORE,Plano,+000,15',
          '1.56 SV,SHOP1,-025,-050,10',
        ],
      },
    ],
  },
  {
    group: 'Semi-finished Blanks',
    templates: [
      {
        id: 'semi_base_add',
        label: 'Blank (Base + ADD)',
        desc: 'e.g. Bifocal blank, Progressive blank 1.56',
        spec_type: 'base_add',
        sphKey: 'base', sphLabel: 'Base',
        hasSph: true, hasCyl: false, hasAxis: false, hasAdd: true, isUtility: false,
        csvCols: ['product_name', 'location_code', 'base', 'addition', 'qty'],
        examples: [
          '1.56 Blank Bifocal,STORE,+200,+100,12',
          '1.56 Blank Bifocal,STORE,+175,+125,8',
          'CR39 Blank Prog,SHOP1,+200,+200,5',
        ],
      },
      {
        id: 'semi_base_only',
        label: 'Blank (Base only)',
        desc: 'e.g. Single vision blank 1.50, CR39 blank',
        spec_type: 'base_only',
        sphKey: 'base', sphLabel: 'Base',
        hasSph: true, hasCyl: false, hasAxis: false, hasAdd: false, isUtility: false,
        csvCols: ['product_name', 'location_code', 'base', 'qty'],
        examples: [
          '1.50 Blank SV,STORE,+200,10',
          '1.50 Blank SV,STORE,Plano,20',
          '1.56 Blank SV,SHOP1,-025,8',
        ],
      },
    ],
  },
  {
    group: 'Order / RX Lenses',
    templates: [
      {
        id: 'order_full',
        label: 'Full Spec (SPH + CYL + AXIS + ADD)',
        desc: 'e.g. Essilor, Hoya HD, Zeiss, custom RX',
        spec_type: 'sph_cyl_axis_add',
        sphKey: 'sph', sphLabel: 'SPH',
        hasSph: true, hasCyl: true, hasAxis: true, hasAdd: true, isUtility: false,
        csvCols: ['product_name', 'location_code', 'sph', 'cyl', 'axis', 'addition', 'qty'],
        examples: [
          'Essilor Varilux,STORE,+200,-050,90,+200,5',
          'Hoya HD SV,STORE,-025,-025,180,,3',
        ],
      },
    ],
  },
  {
    group: 'Utilities / Sundries',
    templates: [
      {
        id: 'utilities',
        label: 'Utilities (Name only)',
        desc: 'e.g. Blue Tint, Cleaning Kit, Frame',
        spec_type: 'name_only',
        sphKey: null, sphLabel: null,
        hasSph: false, hasCyl: false, hasAxis: false, hasAdd: false, isUtility: true,
        csvCols: ['product_name', 'location_code', 'qty'],
        examples: ['Blue Tint,STORE,15', 'AR Coating Kit,SHOP1,8'],
      },
    ],
  },
]
const ALL_TEMPLATES = TEMPLATE_GROUPS.flatMap(g => g.templates)

// ── Shared helpers ────────────────────────────────────────────
function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
  let q = base
  sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
  cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
  axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
  addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
  name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
  return q
}

function buildSpecsFromRow(row, tpl) {
  if (tpl.isUtility) {
    return { sph: null, cyl: null, axis: null, addition: null, name_key: (row.product_name || '').trim() || null }
  }
  const sphVal = (row[tpl.sphKey] || '').trim() || null
  return {
    sph:      sphVal,
    cyl:      tpl.hasCyl ? ((row.cyl && row.cyl !== '-') ? row.cyl.trim() : null) : null,
    axis:     tpl.hasAxis ? ((row.axis && row.axis !== '-') ? row.axis.trim() : null) : null,
    addition: tpl.hasAdd ? ((row.addition && row.addition !== '-') ? row.addition.trim() : null) : null,
    name_key: null,
  }
}

function formatSpecForDisplay(row, tpl) {
  if (tpl.isUtility) return row.product_name || '—'
  const sph = (tpl.sphKey ? row[tpl.sphKey] : null) || ''
  const parts = [sph].filter(Boolean)
  if (tpl.hasCyl && row.cyl && row.cyl !== '-') parts.push(row.cyl)
  if (tpl.hasAxis && row.axis && row.axis !== '-') parts.push('ax' + row.axis)
  if (tpl.hasAdd && row.addition && row.addition !== '-') parts.push('add' + row.addition)
  return parts.join(' / ') || '—'
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return { rows: [] }
  function parseLine(line) {
    const result = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim()); return result
  }
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim())
  const rows = lines.slice(1)
    .map(line => {
      const vals = parseLine(line); const row = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    })
    .filter(row => Object.values(row).some(v => v !== ''))
  return { rows }
}

function downloadTemplate(tpl) {
  const csv = [tpl.csvCols.join(','), ...tpl.examples].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `optisource_${tpl.id}_template.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function validateRows(rawRows, tpl, companyId) {
  const [prodRes, locRes] = await Promise.all([
    supabase.from('products').select('id, name, spec_type').eq('company_id', companyId).eq('is_active', true),
    supabase.from('locations').select('id, name, code').eq('company_id', companyId),
  ])
  const productMap  = Object.fromEntries((prodRes.data || []).map(p => [p.name.toLowerCase().trim(), p]))
  const locationMap = Object.fromEntries((locRes.data  || []).map(l => [l.code.toLowerCase().trim(), l]))

  return rawRows.map((row, i) => {
    const productName  = (row.product_name  || '').trim()
    const locationCode = (row.location_code || '').trim()
    const qty          = parseInt(row.qty, 10)
    const product      = productMap[productName.toLowerCase()]
    const location     = locationMap[locationCode.toLowerCase()]
    const errors = [], warnings = []

    if (!productName)           errors.push('Missing product name')
    else if (!product)          errors.push(`"${productName}" not found — add it in My Products first`)
    if (!locationCode)          errors.push('Missing location code')
    else if (!location)         errors.push(`Location "${locationCode}" not in your list`)
    if (isNaN(qty) || qty <= 0) errors.push('Qty must be a positive number')
    if (product)                warnings.push(`Adds to existing product "${product.name}"`)

    return {
      rowNum: i + 2,
      ...row,
      product_name: productName,
      location_code: locationCode,
      product, location,
      qty: isNaN(qty) ? 0 : qty,
      specs: buildSpecsFromRow(row, tpl),
      errors, warnings,
      status: errors.length ? 'error' : 'ready',
    }
  })
}

async function runImport(validatedRows, importMode, profile) {
  const ready = validatedRows.filter(r => r.status === 'ready')
  let imported = 0, failed = 0
  for (const row of ready) {
    try {
      let q = supabase.from('stock').select('id, qty')
        .eq('product_id', row.product.id).eq('location_id', row.location.id)
      q = buildStockQuery(q, row.specs)
      const { data: existing } = await q.maybeSingle()
      if (existing) {
        const newQty = importMode === 'add' ? existing.qty + row.qty : row.qty
        await supabase.from('stock').update({ qty: newQty, updated_at: new Date() }).eq('id', existing.id)
      } else {
        await supabase.from('stock').insert({
          company_id: profile.company_id, product_id: row.product.id,
          location_id: row.location.id, ...row.specs, qty: row.qty,
        })
      }
      await supabase.from('transactions').insert({
        company_id: profile.company_id, type: 'INVENTORY_ADD',
        product_id: row.product.id, location_id: row.location.id,
        ...row.specs, qty: row.qty, created_by: profile.id, notes: 'Stock import',
      })
      imported++
    } catch { failed++ }
  }
  await supabase.from('audit_log').insert({
    company_id: profile.company_id, user_id: profile.id, status: 'SUCCESS',
    action: 'MIGRATION_IMPORT',
    details: { imported, failed, skipped: validatedRows.filter(r => r.status === 'error').length, mode: importMode },
  })
  return { imported, failed, skipped: validatedRows.filter(r => r.status === 'error').length }
}

// ── Shared UI sub-components ──────────────────────────────────
const SC = 'w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-sm'

function ImportModeCard({ importMode, setImportMode }) {
  const opts = [
    { id: 'add', label: 'Add to existing', desc: 'Stack on top of current stock. Best for top-ups.' },
    { id: 'set', label: 'Replace existing', desc: 'Overwrite with new qty. Best for fresh migration.' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <p className="text-xs font-semibold text-slate-700 mb-3">If this product + spec already has stock at that location…</p>
      <div className="grid grid-cols-2 gap-2">
        {opts.map(opt => (
          <button key={opt.id} onClick={() => setImportMode(opt.id)}
            className={`text-left p-4 rounded-xl border text-xs transition-colors ${
              importMode === opt.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            <p className="font-semibold mb-1">{opt.label}</p>
            <p className={importMode === opt.id ? 'text-slate-400' : 'text-slate-400'}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PreviewTable({ rows, tpl }) {
  const readyRows = rows.filter(r => r.status === 'ready')
  const errorRows = rows.filter(r => r.status === 'error')
  const warnRows  = rows.filter(r => r.status === 'ready' && r.warnings.length > 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{readyRows.length}</p>
          <p className="text-xs text-green-600 mt-0.5">Ready</p>
        </div>
        <div className={`rounded-xl p-4 text-center border ${warnRows.length ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-2xl font-bold ${warnRows.length ? 'text-amber-600' : 'text-slate-300'}`}>{warnRows.length}</p>
          <p className={`text-xs mt-0.5 ${warnRows.length ? 'text-amber-500' : 'text-slate-300'}`}>Match existing</p>
        </div>
        <div className={`rounded-xl p-4 text-center border ${errorRows.length ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-2xl font-bold ${errorRows.length ? 'text-red-600' : 'text-slate-300'}`}>{errorRows.length}</p>
          <p className={`text-xs mt-0.5 ${errorRows.length ? 'text-red-500' : 'text-slate-300'}`}>Will skip</p>
        </div>
      </div>

      {errorRows.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          <strong>{errorRows.length} row{errorRows.length !== 1 ? 's' : ''} will be skipped</strong> due to errors shown in red.
          Fix them and re-enter, or proceed with the {readyRows.length} valid rows.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '22rem', overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">#</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Product</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Loc</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Spec</th>
                <th className="px-3 py-2.5 text-right text-slate-500 font-medium">Qty</th>
                <th className="px-3 py-2.5 text-left text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 ${
                  row.status === 'error' ? 'bg-red-50' : row.warnings.length ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                }`}>
                  <td className="px-3 py-2.5 text-slate-400">{row.rowNum}</td>
                  <td className="px-3 py-2.5 text-slate-900 font-medium">
                    <span className="block truncate max-w-[130px]">{row.product_name || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{row.location_code || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 font-mono whitespace-nowrap">{formatSpecForDisplay(row, tpl)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{row.qty || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.status === 'error'
                      ? <span className="text-red-500">{row.errors[0]}</span>
                      : row.warnings.length
                      ? <span className="text-amber-600">↳ {row.warnings[0]}</span>
                      : <span className="text-green-600 font-medium">Ready</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ImportDone({ summary, onReset }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Import complete</h2>
      <p className="text-sm text-slate-500 mb-6">Your stock has been updated.</p>
      <div className="grid grid-cols-3 gap-3 mb-7 max-w-xs mx-auto">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-700">{summary.imported}</p>
          <p className="text-xs text-green-600">Imported</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${summary.failed ? 'bg-red-50' : 'bg-slate-50'}`}>
          <p className={`text-xl font-bold ${summary.failed ? 'text-red-600' : 'text-slate-300'}`}>{summary.failed}</p>
          <p className={`text-xs ${summary.failed ? 'text-red-500' : 'text-slate-300'}`}>Failed</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-400">{summary.skipped}</p>
          <p className="text-xs text-slate-400">Skipped</p>
        </div>
      </div>
      <button onClick={onReset}
        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
        Import another batch
      </button>
    </div>
  )
}

function ImportingSpinner() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
      <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm font-semibold text-slate-900">Importing stock…</p>
      <p className="text-xs text-slate-400 mt-1">Do not close this tab</p>
    </div>
  )
}

// ── Manual entry mode ─────────────────────────────────────────
function ManualMode({ template, profile }) {
  const [locations, setLocations]         = useState([])
  const [rows, setRows]                   = useState([])
  const [productName, setProductName]     = useState('')
  const [locCode, setLocCode]             = useState('')
  const [sphVal, setSphVal]               = useState(SPH_VALUES[0])
  const [cylVal, setCylVal]               = useState('-')
  const [axisVal, setAxisVal]             = useState('-')
  const [addVal, setAddVal]               = useState('-')
  const [qty, setQty]                     = useState('')
  const [step, setStep]                   = useState('entry')   // entry | validating | preview | importing | done
  const [validatedRows, setValidatedRows] = useState([])
  const [importMode, setImportMode]       = useState('add')
  const [summary, setSummary]             = useState(null)
  const productRef = useRef()

  useEffect(() => {
    if (!profile?.company_id) return
    supabase.from('locations').select('id, name, code').eq('company_id', profile.company_id).order('name')
      .then(({ data }) => {
        setLocations(data || [])
        if (data?.length) setLocCode(data[0].code)
      })
  }, [profile])

  function buildRow() {
    const row = { product_name: productName.trim(), location_code: locCode, qty }
    if (template.hasSph) row[template.sphKey] = sphVal
    if (template.hasCyl)  row.cyl      = cylVal
    if (template.hasAxis) row.axis     = axisVal
    if (template.hasAdd)  row.addition = addVal
    return row
  }

  function addRow() {
    if (!productName.trim() || !locCode || !qty) return
    setRows(r => [...r, { ...buildRow(), _id: Date.now() }])
    setProductName(''); setQty('')
    productRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addRow() }
  }

  async function handleValidate() {
    setStep('validating')
    const validated = await validateRows(rows, template, profile.company_id)
    setValidatedRows(validated)
    setStep('preview')
  }

  async function handleImport() {
    setStep('importing')
    const result = await runImport(validatedRows, importMode, profile)
    setSummary(result)
    setStep('done')
  }

  function reset() {
    setRows([]); setValidatedRows([]); setSummary(null)
    setProductName(''); setQty(''); setStep('entry')
  }

  if (step === 'validating' || step === 'importing') return <ImportingSpinner />
  if (step === 'done' && summary)  return <ImportDone summary={summary} onReset={reset} />

  if (step === 'preview') return (
    <div className="space-y-4">
      <PreviewTable rows={validatedRows} tpl={template} />
      <ImportModeCard importMode={importMode} setImportMode={setImportMode} />
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          ← Re-enter
        </button>
        {validatedRows.filter(r => r.status === 'ready').length > 0 && (
          <button onClick={handleImport}
            className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
            Import {validatedRows.filter(r => r.status === 'ready').length} row{validatedRows.filter(r => r.status === 'ready').length !== 1 ? 's' : ''}
            {validatedRows.filter(r => r.status === 'error').length > 0 && (
              <span className="text-slate-400 font-normal ml-1">
                · {validatedRows.filter(r => r.status === 'error').length} skipped
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      {/* Quick-add form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">Add rows — transcribe directly from your records</p>
        <p className="text-xs text-slate-400 mb-4">Press Enter or click "+ Add row" after each entry.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Product name</label>
            <input ref={productRef} type="text" value={productName}
              onChange={e => setProductName(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="e.g. 1.56 Bifocal" className={SC} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <select value={locCode} onChange={e => setLocCode(e.target.value)} className={SC}>
              {locations.map(l => <option key={l.id} value={l.code}>{l.code}</option>)}
            </select>
          </div>
          {template.hasSph && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{template.sphLabel}</label>
              <select value={sphVal} onChange={e => setSphVal(e.target.value)} className={SC}>
                {SPH_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {template.hasCyl && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CYL</label>
              <select value={cylVal} onChange={e => setCylVal(e.target.value)} className={SC}>
                {CYL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {template.hasAxis && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Axis</label>
              <select value={axisVal} onChange={e => setAxisVal(e.target.value)} className={SC}>
                {AXIS_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {template.hasAdd && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Addition</label>
              <select value={addVal} onChange={e => setAddVal(e.target.value)} className={SC}>
                {ADD_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Qty</label>
            <input type="number" min="1" value={qty}
              onChange={e => setQty(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="50" className={SC} />
          </div>
        </div>

        <button onClick={addRow} disabled={!productName.trim() || !locCode || !qty}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40">
          + Add row
        </button>
      </div>

      {/* Accumulated rows table */}
      {rows.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">{rows.length} row{rows.length !== 1 ? 's' : ''} ready to validate</p>
              <button onClick={() => setRows([])} className="text-xs text-red-400 hover:text-red-600 transition-colors">Clear all</button>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '18rem', overflowY: 'auto' }}>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Product</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Loc</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Spec</th>
                    <th className="px-4 py-2 text-right text-slate-500 font-medium">Qty</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900 font-medium">
                        <span className="block truncate max-w-[160px]">{row.product_name}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{row.location_code}</td>
                      <td className="px-4 py-2 text-slate-500 font-mono">{formatSpecForDisplay(row, template)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{row.qty}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => setRows(r => r.filter(x => x._id !== row._id))}
                          className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={handleValidate}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
            Validate {rows.length} row{rows.length !== 1 ? 's' : ''} →
          </button>
        </>
      )}
    </div>
  )
}

// ── CSV upload mode ───────────────────────────────────────────
function CSVMode({ template, profile }) {
  const [step, setStep]                   = useState('upload')
  const [validatedRows, setValidatedRows] = useState([])
  const [importMode, setImportMode]       = useState('add')
  const [dragging, setDragging]           = useState(false)
  const [fileError, setFileError]         = useState('')
  const [importing, setImporting]         = useState(false)
  const [summary, setSummary]             = useState(null)
  const fileRef = useRef()

  async function processFile(file) {
    if (!file) return
    if (!file.name.match(/\.(csv|txt)$/i)) { setFileError('Please upload a .csv file.'); return }
    setFileError('')
    const text = await file.text()
    const { rows: csvRows } = parseCSV(text)
    if (!csvRows.length) { setFileError('File appears empty or could not be read.'); return }

    // Normalise: accept both 'sph'/'base' interchangeably for the sph column
    const normalized = csvRows.map(row => {
      const r = { ...row }
      if (template.sphKey === 'base' && !r.base && r.sph) r.base = r.sph
      if (template.sphKey === 'sph'  && !r.sph  && r.base) r.sph = r.base
      return r
    })
    const validated = await validateRows(normalized, template, profile.company_id)
    setValidatedRows(validated)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const result = await runImport(validatedRows, importMode, profile)
    setSummary(result); setImporting(false); setStep('done')
  }

  function reset() {
    setStep('upload'); setValidatedRows([]); setFileError(''); setSummary(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (importing)                   return <ImportingSpinner />
  if (step === 'done' && summary)  return <ImportDone summary={summary} onReset={reset} />

  if (step === 'preview') return (
    <div className="space-y-4">
      <PreviewTable rows={validatedRows} tpl={template} />
      <ImportModeCard importMode={importMode} setImportMode={setImportMode} />
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          ← Re-upload
        </button>
        {validatedRows.filter(r => r.status === 'ready').length > 0 && (
          <button onClick={handleImport}
            className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
            Import {validatedRows.filter(r => r.status === 'ready').length} row{validatedRows.filter(r => r.status === 'ready').length !== 1 ? 's' : ''}
            {validatedRows.filter(r => r.status === 'error').length > 0 && (
              <span className="text-slate-400 font-normal ml-1">· {validatedRows.filter(r => r.status === 'error').length} skipped</span>
            )}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Download template */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-start gap-4">
        <span className="text-2xl flex-shrink-0 mt-0.5">📄</span>
        <div>
          <p className="text-sm font-semibold mb-1">Step 1 — download the {template.label} template</p>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Fill it in from your records. Product names must exactly match what's in your My Products list. Location codes must match too.
          </p>
          <button onClick={() => downloadTemplate(template)}
            className="text-xs bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100 transition-colors">
            Download template CSV
          </button>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files?.[0]) }}
        onClick={() => fileRef.current?.click()}
        className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
        }`}
      >
        <p className="text-4xl mb-3">📂</p>
        <p className="text-sm font-semibold text-slate-900 mb-1">
          {dragging ? 'Drop to upload' : 'Step 2 — upload your filled CSV'}
        </p>
        <p className="text-xs text-slate-400">click or drag and drop · .csv files only</p>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => processFile(e.target.files?.[0])} />
      </div>

      {fileError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{fileError}</div>
      )}

      {/* Column guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-700 mb-3">
          Expected columns for <span className="text-slate-900">{template.label}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {template.csvCols.map(col => (
            <code key={col} className="bg-slate-100 px-2 py-1 rounded-lg font-mono text-xs text-slate-700">{col}</code>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Import data tab ───────────────────────────────────────────
function ImportDataTab({ profile }) {
  const [selectedTplId, setSelectedTplId] = useState('finished_sph_add')
  const [mode, setMode] = useState('manual')
  const template = ALL_TEMPLATES.find(t => t.id === selectedTplId) || ALL_TEMPLATES[0]

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-base font-semibold text-slate-800 mb-1">Import stock data</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Choose the lens category that matches your records. Then enter manually (ideal for paper records) or upload a filled CSV.
          Products must already exist in your <strong>My Products</strong> list.
        </p>
      </div>

      {/* Template picker — grouped */}
      <div className="mb-6 space-y-5">
        {TEMPLATE_GROUPS.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{group.group}</p>
            <div className="flex flex-wrap gap-2">
              {group.templates.map(tpl => (
                <button key={tpl.id} onClick={() => setSelectedTplId(tpl.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-xs transition-colors ${
                    selectedTplId === tpl.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="font-semibold">{tpl.label}</p>
                  <p className={`mt-0.5 ${selectedTplId === tpl.id ? 'text-slate-400' : 'text-slate-400'}`}>{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ id: 'manual', label: '✏️  Manual entry' }, { id: 'csv', label: '📄  CSV upload' }].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* key forces remount (full reset) when template changes */}
      {mode === 'manual' && <ManualMode key={`m-${selectedTplId}`} template={template} profile={profile} />}
      {mode === 'csv'    && <CSVMode    key={`c-${selectedTplId}`} template={template} profile={profile} />}
    </div>
  )
}

// ── Main Products page ────────────────────────────────────────
const TABS = ['My Products', 'Global Catalogue']

export default function Products() {
  const { profile } = useAuth()
  const [tab, setTab]             = useState('My Products')
  const [products, setProducts]   = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [classes, setClasses]     = useState([])
  const [adopted, setAdopted]     = useState(new Set())
  const [filterClass, setFilter]  = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [form, setForm]           = useState({ name: '', class_id: '', spec_type: 'sph_add', new_class: '' })
  const [isCreatingClass, setIsCreatingClass] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState({ type: '', text: '' })

  useEffect(() => {
    if (profile?.company_id) { fetchClasses(); fetchProducts(); fetchCatalogue() }
  }, [profile])

  async function fetchClasses() {
    const { data } = await supabase.from('product_classes').select('*')
      .eq('company_id', profile.company_id).order('name')
    setClasses(data || [])
    if (data?.length && !form.class_id && !isCreatingClass) setForm(f => ({ ...f, class_id: data[0].id }))
  }
  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*, product_classes(name)')
      .eq('company_id', profile.company_id).order('name')
    setProducts(data || [])
    setAdopted(new Set(data?.map(p => p.global_product_id).filter(Boolean)))
  }
  async function fetchCatalogue() {
    const { data } = await supabase.from('global_products').select('*')
      .eq('is_active', true).order('class_name').order('name')
    setCatalogue(data || [])
  }

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000) }

  async function addCustomProduct(e) {
    e.preventDefault()
    if (!form.name.trim()) { flash('error', 'Name is required'); return }
    
    setLoading(true)
    let finalClassId = form.class_id

    if (isCreatingClass) {
      if (!form.new_class.trim()) { flash('error', 'Class name is required'); setLoading(false); return }
      const { data, error } = await supabase.from('product_classes').insert({
        company_id: profile.company_id, name: form.new_class.trim()
      }).select().single()
      if (error) { flash('error', error.message); setLoading(false); return }
      finalClassId = data.id
      setClasses(curr => [...curr, data])
      setIsCreatingClass(false)
      setForm(f => ({ ...f, class_id: data.id, new_class: '' }))
    }

    if (!finalClassId) { flash('error', 'Please select or create a class'); setLoading(false); return }

    const { error } = await supabase.from('products').insert({
      company_id: profile.company_id, class_id: finalClassId,
      name: form.name.trim(), spec_type: form.spec_type,
    })
    if (error) flash('error', error.message)
    else { flash('success', 'Product added'); setForm(f => ({ ...f, name: '' })); fetchProducts() }
    setLoading(false)
  }

  async function adoptProduct(gp) {
    if (adopted.has(gp.id)) return
    setLoading(true)
    let matchClass = classes.find(c => c.name === gp.class_name)
    if (!matchClass) {
      const { data, error } = await supabase.from('product_classes').insert({
        company_id: profile.company_id, name: gp.class_name
      }).select().single()
      if (error) { flash('error', error.message); setLoading(false); return }
      matchClass = data
      setClasses(curr => [...curr, data])
    }
    const { error } = await supabase.from('products').insert({
      company_id: profile.company_id, class_id: matchClass.id,
      name: gp.name, spec_type: gp.spec_type, global_product_id: gp.id,
    })
    if (error) flash('error', error.message)
    else { flash('success', `${gp.name} added`); fetchProducts() }
    setLoading(false)
  }

  async function adoptAll() {
    const toAdopt = filteredCat.filter(gp => !adopted.has(gp.id))
    if (!toAdopt.length) { flash('error', 'All shown products already added'); return }
    setLoading(true)
    let added = 0
    let currentClasses = [...classes]
    for (const gp of toAdopt) {
      let matchClass = currentClasses.find(c => c.name === gp.class_name)
      if (!matchClass) {
        const { data, error } = await supabase.from('product_classes').insert({
          company_id: profile.company_id, name: gp.class_name
        }).select().single()
        if (!error && data) {
          matchClass = data
          currentClasses.push(data)
          setClasses([...currentClasses])
        } else continue
      }
      const { error } = await supabase.from('products').insert({
        company_id: profile.company_id, class_id: matchClass.id,
        name: gp.name, spec_type: gp.spec_type, global_product_id: gp.id,
      })
      if (!error) added++
    }
    await fetchProducts()
    flash('success', `${added} products added`)
    setLoading(false)
  }

  async function toggleActive(p) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    fetchProducts()
  }

  const classNames   = [...new Set(catalogue.map(p => p.class_name))]
  const filteredCat  = catFilter === 'all' ? catalogue : catalogue.filter(p => p.class_name === catFilter)
  const filteredMine = filterClass === 'all' ? products : products.filter(p => p.class_id === filterClass)

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 lg:px-6 lg:py-10">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Products</h2>
        <p className="text-slate-500 text-sm mb-6">
          Add from the global catalogue, create custom products, or import your existing stock data.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Flash */}
        {msg.text && (
          <div className={`mb-4 text-sm rounded-xl px-4 py-3 ${
            msg.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {msg.text}
          </div>
        )}

        {/* ── My Products ── */}
        {tab === 'My Products' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">Add custom product</h3>
              <form onSubmit={addCustomProduct} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input type="text" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. FUSE PHOTO"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                      <span>Class</span>
                      <button type="button" onClick={() => setIsCreatingClass(!isCreatingClass)} className="text-xs text-blue-600 font-semibold hover:underline">
                        {isCreatingClass ? 'Cancel' : '+ New Class'}
                      </button>
                    </label>
                    {isCreatingClass ? (
                      <input type="text" value={form.new_class}
                        onChange={e => setForm(f => ({ ...f, new_class: e.target.value }))}
                        placeholder="e.g. Frames"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    ) : (
                      <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                        {classes.length === 0 && <option value="">-- Click + New Class --</option>}
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spec type</label>
                    <select value={form.spec_type} onChange={e => setForm(f => ({ ...f, spec_type: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                      {Object.entries(SPEC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add product'}
                </button>
              </form>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterClass === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}>
                All ({products.length})
              </button>
              {classes.map(c => (
                <button key={c.id} onClick={() => setFilter(c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterClass === c.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {c.name} ({products.filter(p => p.class_id === c.id).length})
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {filteredMine.length === 0
                ? <div className="text-center py-12 text-slate-400 text-sm">No products yet. Add from the catalogue or create a custom one above.</div>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Name</th>
                          <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Class</th>
                          <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Spec type</th>
                          <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Status</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMine.map(p => (
                          <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-5 py-3 font-medium text-slate-800 text-sm">{p.name}</td>
                            <td className="px-5 py-3 text-slate-500 text-sm">{p.product_classes?.name}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{SPEC_LABELS[p.spec_type]}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                p.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {p.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => toggleActive(p)} className="text-xs text-slate-400 hover:text-slate-700">
                                {p.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </>
        )}

        {/* ── Global Catalogue ── */}
        {tab === 'Global Catalogue' && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCatFilter('all')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    catFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}>
                  All ({catalogue.length})
                </button>
                {classNames.map(cn => (
                  <button key={cn} onClick={() => setCatFilter(cn)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      catFilter === cn ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}>
                    {cn}
                  </button>
                ))}
              </div>
              <button onClick={adoptAll} disabled={loading}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Adding...' : `Add all shown (${filteredCat.filter(p => !adopted.has(p.id)).length})`}
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Name</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Class</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Spec type</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCat.map(gp => (
                      <tr key={gp.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800 text-sm">{gp.name}</td>
                        <td className="px-5 py-3 text-slate-500 text-sm">{gp.class_name}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{SPEC_LABELS[gp.spec_type]}</td>
                        <td className="px-5 py-3 text-right">
                          {adopted.has(gp.id)
                            ? <span className="text-xs text-green-600 font-medium">Added</span>
                            : <button onClick={() => adoptProduct(gp)}
                                className="text-xs bg-slate-900 text-white px-3 py-1 rounded-lg hover:bg-slate-700">
                                Add
                              </button>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </Layout>
  )
}