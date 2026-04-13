import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'

// ── CSV parser (handles quoted fields + Windows line endings)
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line) {
    const result = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim())
  const rows = lines.slice(1)
    .map(line => {
      const vals = parseLine(line)
      const row = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    })
    .filter(row => Object.values(row).some(v => v !== ''))

  return { headers, rows }
}

// ── Template CSV download
const TEMPLATE_HEADERS = 'product_name,location_code,sph,cyl,axis,addition,qty'
const TEMPLATE_EXAMPLES = [
  '1.56 Bifocal,STORE,+200,-,-,+100,50',
  '1.56 Bifocal,SHOP1,+175,-,-,+100,30',
  'CR39 SV,STORE,-025,-025,-,-,20',
  'CR39 SV,SHOP1,Plano,-,-,-,12',
  'Blue Tint,STORE,,,,, 15',
]
function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'optisource_stock_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const COLUMN_GUIDE = [
  { col: 'product_name',  req: true,  note: 'Must exactly match a product name in your catalogue' },
  { col: 'location_code', req: true,  note: 'Must match a location code — e.g. STORE, SHOP1' },
  { col: 'qty',           req: true,  note: 'A positive whole number' },
  { col: 'sph',           req: false, note: 'e.g. Plano, +200, -025 — leave blank for name-only products' },
  { col: 'cyl',           req: false, note: 'e.g. -, -025, +050' },
  { col: 'axis',          req: false, note: 'e.g. -, 90, 180' },
  { col: 'addition',      req: false, note: 'e.g. -, +100, +200' },
]

export default function Migrate() {
  const { profile } = useAuth()
  const fileRef = useRef()

  const [step,       setStep]       = useState('upload')  // upload | preview | importing | done
  const [rows,       setRows]       = useState([])
  const [progress,   setProgress]   = useState(0)
  const [importMode, setImportMode] = useState('set')     // set | add
  const [summary,    setSummary]    = useState(null)
  const [fileError,  setFileError]  = useState('')
  const [dragging,   setDragging]   = useState(false)

  const readyRows = rows.filter(r => r.status === 'ready')
  const errorRows = rows.filter(r => r.status === 'error')

  const stepLabels  = ['Upload', 'Preview', 'Import']
  const stepIdx     = step === 'upload' ? 0 : step === 'preview' ? 1 : 2

  async function processFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setFileError('Please upload a .csv file.')
      return
    }
    setFileError('')

    const text = await file.text()
    const { headers, rows: csvRows } = parseCSV(text)

    if (!csvRows.length) {
      setFileError('CSV appears to be empty or malformatted.')
      return
    }

    const col = (...aliases) => aliases.find(a => headers.includes(a)) || null
    const productCol  = col('product_name', 'product')
    const locationCol = col('location_code', 'location')
    const qtyCol      = col('qty', 'quantity')
    const sphCol      = col('sph')
    const cylCol      = col('cyl')
    const axisCol     = col('axis')
    const addCol      = col('addition', 'add')

    if (!productCol || !locationCol || !qtyCol) {
      setFileError(
        'Missing required columns. Found: ' + headers.join(', ') +
        '. Need at minimum: product_name, location_code, qty'
      )
      return
    }

    const [prodRes, locRes] = await Promise.all([
      supabase.from('products').select('id, name, spec_type')
        .eq('company_id', profile.company_id).eq('is_active', true),
      supabase.from('locations').select('id, name, code')
        .eq('company_id', profile.company_id),
    ])

    const productMap  = Object.fromEntries((prodRes.data  || []).map(p => [p.name.toLowerCase().trim(), p]))
    const locationMap = Object.fromEntries((locRes.data   || []).map(l => [l.code.toLowerCase().trim(), l]))

    const validated = csvRows.map((row, i) => {
      const productName  = (row[productCol]  || '').trim()
      const locationCode = (row[locationCol] || '').trim()
      const qty          = parseInt(row[qtyCol], 10)
      const product      = productMap[productName.toLowerCase()]
      const location     = locationMap[locationCode.toLowerCase()]
      const errs         = []

      if (!productName)           errs.push('Missing product name')
      else if (!product)          errs.push('Product not found: "' + productName + '"')
      if (!locationCode)          errs.push('Missing location code')
      else if (!location)         errs.push('Location not found: "' + locationCode + '"')
      if (isNaN(qty) || qty <= 0) errs.push('Qty must be a positive number')

      const isUtility = product?.spec_type === 'name_only'
      const rawSph    = sphCol  ? (row[sphCol]  || '').trim() : ''
      const rawCyl    = cylCol  ? (row[cylCol]  || '').trim() : ''
      const rawAxis   = axisCol ? (row[axisCol] || '').trim() : ''
      const rawAdd    = addCol  ? (row[addCol]  || '').trim() : ''

      const specs = {
        sph:      isUtility ? null : (rawSph || null),
        cyl:      isUtility ? null : (!rawCyl  || rawCyl  === '-' ? null : rawCyl),
        axis:     isUtility ? null : (!rawAxis || rawAxis === '-' ? null : rawAxis),
        addition: isUtility ? null : (!rawAdd  || rawAdd  === '-' ? null : rawAdd),
        name_key: isUtility ? (product?.name || null) : null,
      }

      return {
        rowNum: i + 2,
        productName, locationCode, qty,
        product, location, specs,
        errors: errs,
        status: errs.length ? 'error' : 'ready',
      }
    })

    setRows(validated)
    setStep('preview')
  }

  function handleFileInput(e)  { processFile(e.target.files?.[0]) }
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files?.[0])
  }

  function reset() {
    setStep('upload')
    setRows([])
    setSummary(null)
    setProgress(0)
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImport() {
    if (!readyRows.length) return
    setStep('importing')
    setProgress(0)

    let imported = 0
    let failed   = 0

    for (let i = 0; i < readyRows.length; i++) {
      const row = readyRows[i]
      try {
        const s = row.specs
        let q = supabase.from('stock').select('id, qty')
          .eq('product_id', row.product.id)
          .eq('location_id', row.location.id)
        s.sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', s.sph)
        s.cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', s.cyl)
        s.axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', s.axis)
        s.addition === null ? q = q.is('addition', null) : q = q.eq('addition', s.addition)
        s.name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', s.name_key)

        const { data: existing } = await q.maybeSingle()

        if (existing) {
          const newQty = importMode === 'add' ? existing.qty + row.qty : row.qty
          await supabase.from('stock')
            .update({ qty: newQty, updated_at: new Date() })
            .eq('id', existing.id)
        } else {
          await supabase.from('stock').insert({
            company_id:  profile.company_id,
            product_id:  row.product.id,
            location_id: row.location.id,
            ...s,
            qty: row.qty,
          })
        }

        await supabase.from('transactions').insert({
          company_id:  profile.company_id,
          type:        'INVENTORY_ADD',
          product_id:  row.product.id,
          location_id: row.location.id,
          ...s,
          qty:         row.qty,
          created_by:  profile.id,
          notes:       'CSV migration import',
        })
        imported++
      } catch (_) {
        failed++
      }

      setProgress(Math.round(((i + 1) / readyRows.length) * 100))
    }

    await supabase.from('audit_log').insert({
      company_id: profile.company_id,
      user_id:    profile.id,
      status:     'SUCCESS',
      action:     'MIGRATION_IMPORT',
      details:    { imported, failed, skipped: errorRows.length, mode: importMode },
    })

    setSummary({ imported, failed, skipped: errorRows.length })
    setStep('done')
  }

  function specLabel(row) {
    if (row.specs?.name_key) return row.specs.name_key
    const parts = [row.specs?.sph, row.specs?.addition].filter(Boolean)
    return parts.join(' / ') || '—'
  }

  // ── Shared select style
  const inp = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6 lg:py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Data migration</h1>
          <p className="text-sm text-slate-500">
            Import stock from a CSV or Google Sheets export.{' '}
            <Link to="/admin/products" className="text-slate-900 underline underline-offset-2">
              View your products
            </Link>{' '}
            to check exact product names before uploading.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const done   = stepIdx > i
            const active = stepIdx === i
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                  done   ? 'bg-green-500 text-white' :
                  active ? 'bg-slate-900 text-white' :
                           'bg-slate-100 text-slate-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium ${active || done ? 'text-slate-900' : 'text-slate-400'}`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className="w-8 h-px bg-slate-200 mx-1" />
                )}
              </div>
            )
          })}
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-4">

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-start gap-4">
              <span className="text-2xl flex-shrink-0 mt-0.5">📄</span>
              <div>
                <p className="text-sm font-semibold mb-1">Step 1 — download the template</p>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Fill it in from your Google Sheets data. Product names and location codes
                  must match exactly what is in Optisource.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="text-xs bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
                >
                  Download template CSV
                </button>
              </div>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                dragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <p className="text-4xl mb-3">📂</p>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                {dragging ? 'Drop to upload' : 'Click to upload your CSV'}
              </p>
              <p className="text-xs text-slate-400">or drag and drop · .csv files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {fileError && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
                {fileError}
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-700 mb-3">Column reference</p>
              <div className="space-y-2">
                {COLUMN_GUIDE.map(({ col, req, note }) => (
                  <div key={col} className="flex items-start gap-3 text-xs">
                    <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700 flex-shrink-0">
                      {col}
                    </code>
                    <span className={req ? 'text-red-500 flex-shrink-0' : 'text-slate-300 flex-shrink-0'}>
                      {req ? 'required' : 'optional'}
                    </span>
                    <span className="text-slate-400">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && (
          <div className="space-y-4">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{readyRows.length}</p>
                <p className="text-xs text-green-600 mt-0.5">Ready to import</p>
              </div>
              <div className={`rounded-xl p-4 text-center border ${
                errorRows.length
                  ? 'bg-red-50 border-red-100'
                  : 'bg-slate-50 border-slate-100'
              }`}>
                <p className={`text-2xl font-bold ${errorRows.length ? 'text-red-600' : 'text-slate-300'}`}>
                  {errorRows.length}
                </p>
                <p className={`text-xs mt-0.5 ${errorRows.length ? 'text-red-500' : 'text-slate-300'}`}>
                  Will be skipped
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-600">{rows.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total rows</p>
              </div>
            </div>

            {errorRows.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
                <strong>{errorRows.length} row{errorRows.length !== 1 ? 's' : ''} will be skipped</strong> due to errors shown
                in red below. Fix in your CSV and re-upload, or proceed with the {readyRows.length} valid rows now.
              </div>
            )}

            {/* Import mode */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-700 mb-3">If a stock row already exists…</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setImportMode('set')}
                  className={`text-left p-4 rounded-xl border text-xs transition-colors ${
                    importMode === 'set'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="font-semibold mb-1">Replace qty</p>
                  <p className={importMode === 'set' ? 'text-slate-300' : 'text-slate-400'}>
                    Overwrite existing stock with CSV value. Best for a fresh migration.
                  </p>
                </button>
                <button
                  onClick={() => setImportMode('add')}
                  className={`text-left p-4 rounded-xl border text-xs transition-colors ${
                    importMode === 'add'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <p className="font-semibold mb-1">Add to qty</p>
                  <p className={importMode === 'add' ? 'text-slate-300' : 'text-slate-400'}>
                    Stack CSV qty on top of existing stock. Best for topping up.
                  </p>
                </button>
              </div>
            </div>

            {/* Row table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  Row preview ({rows.length} rows)
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Re-upload
                </button>
              </div>
              <div className="overflow-x-auto" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium">#</th>
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">Product</th>
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">Location</th>
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Spec</th>
                      <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Qty</th>
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-t border-slate-100 ${
                          row.status === 'error' ? 'bg-red-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-slate-400">{row.rowNum}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-medium max-w-xs">
                          <span className="block truncate" style={{ maxWidth: '160px' }}>
                            {row.productName || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {row.locationCode || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                          {specLabel(row)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {isNaN(row.qty) ? '—' : row.qty}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row.status === 'ready' ? (
                            <span className="text-green-600 font-medium">Ready</span>
                          ) : (
                            <span className="text-red-500" title={row.errors.join(' · ')}>
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {readyRows.length > 0 ? (
              <button
                onClick={handleImport}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Import {readyRows.length} row{readyRows.length !== 1 ? 's' : ''}
                {errorRows.length > 0 && (
                  <span className="text-slate-400 font-normal"> · {errorRows.length} skipped</span>
                )}
              </button>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600 text-center">
                All rows have errors. Fix your CSV and re-upload.
              </div>
            )}
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <p className="text-sm font-semibold text-slate-900 mb-1">Importing stock…</p>
            <p className="text-xs text-slate-400 mb-6">
              {Math.round((progress / 100) * readyRows.length)} of {readyRows.length} rows
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2 max-w-xs mx-auto overflow-hidden">
              <div
                className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                style={{ width: progress + '%' }}
              />
            </div>
            <p className="text-xs text-slate-300 mt-3">Do not close this tab</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && summary && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Migration complete</h2>
            <p className="text-sm text-slate-500 mb-6">Your stock data has been imported.</p>

            <div className="grid grid-cols-3 gap-3 mb-7 max-w-xs mx-auto">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-700">{summary.imported}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${summary.failed ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-xl font-bold ${summary.failed ? 'text-red-600' : 'text-slate-300'}`}>
                  {summary.failed}
                </p>
                <p className={`text-xs ${summary.failed ? 'text-red-500' : 'text-slate-300'}`}>Failed</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-slate-400">{summary.skipped}</p>
                <p className="text-xs text-slate-400">Skipped</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                to="/query"
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Check stock query
              </Link>
              <button
                onClick={reset}
                className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Import another file
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}