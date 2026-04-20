// src/pages/reports/OrderDetail.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import { compressImage } from '../../utils/image'

const STATUS_STYLES = {
  pending:    'bg-amber-100 text-amber-700',
  confirmed:  'bg-blue-100 text-blue-700',
  rejected:   'bg-red-100 text-red-600',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
}

function formatSpec(spec) {
  if (!spec) return '—'
  if (spec.name_key) return spec.name_key
  const parts = []
  if (spec.sph) parts.push(spec.sph)
  if (spec.cyl && spec.cyl !== '-') parts.push(spec.cyl)
  if (spec.axis && spec.axis !== '-') parts.push(`ax${spec.axis}`)
  if (spec.addition && spec.addition !== '-') parts.push(`add${spec.addition}`)
  return parts.join(' / ') || '—'
}

function timeStr(ts) {
  return new Date(ts).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function OrderDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'company_admin' || profile?.role === 'super_admin' || profile?.role === 'staff' || profile?.role === 'manager'
  const isCompanyUser = profile?.role === 'company_admin' || profile?.role === 'super_admin' || profile?.role === 'staff' || profile?.role === 'manager'

  const [order, setOrder]       = useState(null)
  const [items, setItems]       = useState([])
  const [messages, setMessages] = useState([])
  const [banks, setBanks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [msgText, setMsgText]   = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [sending, setSending]   = useState(false)
  const [actioning, setActioning] = useState(false)
  const [locations, setLocations] = useState([])
  const [dispatchLoc, setDispatchLoc] = useState('')
  const bottomRef = useRef(null)

  function buildStockQuery(base, { sph, cyl, axis, addition, name_key }) {
    let q = base
    sph      === null ? q = q.is('sph', null)      : q = q.eq('sph', sph)
    cyl      === null ? q = q.is('cyl', null)      : q = q.eq('cyl', cyl)
    axis     === null ? q = q.is('axis', null)     : q = q.eq('axis', axis)
    addition === null ? q = q.is('addition', null) : q = q.eq('addition', addition)
    name_key === null ? q = q.is('name_key', null) : q = q.eq('name_key', name_key)
    return q
  }

  useEffect(() => {
    if (!profile || !id) return
    fetchAll()
  }, [profile, id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchAll() {
    setLoading(true)
    const [orderRes, itemsRes, msgsRes] = await Promise.all([
      supabase.from('optician_orders').select('*').eq('id', id).single(),
      supabase.from('optician_order_items').select('*').eq('order_id', id).order('created_at'),
      supabase.from('order_messages').select('*').eq('order_id', id).order('created_at'),
    ])
    const ord = orderRes.data
    setOrder(ord)
    setItems(itemsRes.data || [])
    setMessages(msgsRes.data || [])

    // Fetch bank accounts for this supplier
    if (ord?.company_id) {
      const { data: bankData } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('company_id', ord.company_id)
        .order('is_primary', { ascending: false })
      setBanks(bankData || [])
    }
    
    // Fetch locations for dispatch if admin
    if (isAdmin && profile?.company_id) {
      const { data: locs } = await supabase.from('locations').select('*').eq('company_id', profile.company_id)
      setLocations(locs || [])
      if (locs?.length) setDispatchLoc(locs[0].id)
    }

    setLoading(false)
  }

  async function sendMessage(e) {
    if (e) e.preventDefault()
    if (!msgText.trim() && !imageFile) return
    setSending(true)
    
    try {
      let imageUrl = null
      if (imageFile) {
        let payloadToUpload = imageFile
        try {
          payloadToUpload = await compressImage(imageFile, 1200, 0.75)
        } catch (e) {
          console.warn("Compression failed, uploading original. Error:", e)
        }
        
        const ext = payloadToUpload.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        
        const { data, error } = await supabase.storage.from('order-attachments').upload(fileName, payloadToUpload)
        if (error || !data) {
          alert("Failed to upload image: " + (error?.message || "Unknown error"))
          setSending(false)
          return
        }
        const { data: pub } = supabase.storage.from('order-attachments').getPublicUrl(fileName)
        imageUrl = pub.publicUrl
      }

      // Support both authenticated users and guest opticians
      const senderName = profile?.full_name || order?.optician_name || 'Optician'
      const senderRole = profile?.role || 'optician'
      const senderId   = profile?.id || order?.optician_id || null

      await supabase.from('order_messages').insert({
        order_id:    id,
        sender_id:   senderId,
        sender_name: senderName,
        sender_role: senderRole,
        message:     msgText.trim() || null,
        image_url:   imageUrl,
      })
      setMsgText(''); setImageFile(null)
      
      // Refresh messages
      const { data } = await supabase.from('order_messages').select('*').eq('order_id', id).order('created_at')
      setMessages(data || [])
    } catch (err) {
      console.error("SendMessage crash:", err)
      alert("An unexpected error occurred: " + err.message)
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(newStatus) {
    if (newStatus === 'dispatched' && !dispatchLoc) {
       alert('Please select a dispatch location first.')
       return
    }
    if (!window.confirm(`Mark this order as ${newStatus}?`)) return
    setActioning(true)

    // Release any allocated stock
    if (newStatus === 'rejected' || newStatus === 'dispatched') {
      for (const item of items) {
        if (item.allocations && item.allocations.length > 0) {
          for (const alloc of item.allocations) {
            const { data: stockRow } = await supabase.from('stock').select('id, allocated_qty').eq('id', alloc.stock_id).maybeSingle()
            if (stockRow) {
              const newAllocated = Math.max(0, (stockRow.allocated_qty || 0) - alloc.qty)
              await supabase.from('stock').update({ allocated_qty: newAllocated }).eq('id', alloc.stock_id)
            }
          }
        }
      }
    }

    // Handle fulfillment deduction
    if (newStatus === 'dispatched') {
      for (const item of items) {
        // Log SALE transaction
        await supabase.from('transactions').insert({
          company_id: order.company_id,
          type: 'SALE',
          product_id: item.product_id,
          location_id: dispatchLoc,
          qty: item.qty,
          unit_price: item.unit_price,
          total_amount: item.subtotal,
          customer_name: order.optician_name,
          created_by: profile.id,
          ...item.spec_details
        })

        // Deduct from stock
        let base = supabase.from('stock').select('id, qty').eq('product_id', item.product_id).eq('location_id', dispatchLoc)
        const { data: stockRow } = await buildStockQuery(base, item.spec_details).maybeSingle()
        if (stockRow) {
          await supabase.from('stock').update({ qty: stockRow.qty - item.qty }).eq('id', stockRow.id)
        }
      }
      
      // Log audit with full item detail
      await supabase.from('audit_log').insert({
        company_id: profile.company_id, user_id: profile.id,
        status: 'SUCCESS', action: 'SALE',
        details: {
          action: 'Order Dispatched',
          order_id: id,
          optician: order.optician_name,
          dispatch_location: locations.find(l => l.id === dispatchLoc)?.code || dispatchLoc,
          items: items.map(item => ({
            product: item.product_name,
            spec: item.spec_details,
            qty: item.qty,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          })),
          total: items.reduce((s, i) => s + (i.subtotal || 0), 0),
        }
      })
    }

    await supabase.from('optician_orders')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', id)

    // Auto-send a status message
    const statusMessages = {
      confirmed:  '✅ Order confirmed! Please use the bank details below to make payment.',
      rejected:   '❌ Order rejected. Please reach out to discuss.',
      dispatched: '🚚 Your order has been dispatched and is on its way!',
      delivered:  '📦 Order marked as delivered. Thank you for your business!',
    }
    if (statusMessages[newStatus]) {
      await supabase.from('order_messages').insert({
        order_id:    id,
        sender_id:   profile.id,
        sender_name: profile.full_name,
        sender_role: profile.role,
        message:     statusMessages[newStatus],
      })
      // When confirmed, also send the payment reference instruction
      if (newStatus === 'confirmed') {
        await supabase.from('order_messages').insert({
          order_id:    id,
          sender_id:   profile.id,
          sender_name: profile.full_name,
          sender_role: profile.role,
          message:     `Kindly use your order ID as payment description: ${id.slice(0, 8).toUpperCase()}`,
        })
      }
    }
    await fetchAll()
    setActioning(false)
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  )

  if (!order) return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-slate-400">Order not found.</p>
      </div>
    </Layout>
  )

  const totalKnown = items.reduce((s, i) => s + (i.subtotal || 0), 0)
  const hasUnpriced = items.some(i => i.unit_price == null)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 lg:px-6 lg:py-10 space-y-5">

        {/* ── Back + Header ── */}
        <div>
          <button onClick={() => navigate('/orders')}
            className="text-xs text-slate-400 hover:text-slate-700 mb-4 flex items-center gap-1">
            ← Back to orders
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-sm text-slate-500">
                {isAdmin ? `From ${order.optician_name}` : `To ${order.company_name || 'Supplier'}`}
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${STATUS_STYLES[order.status]}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* ── Order items ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order items</p>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map(item => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{formatSpec(item.spec_details)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-800">×{item.qty}</p>
                  <p className="text-xs text-slate-400">
                    {item.unit_price != null
                      ? `₦${Number(item.unit_price).toLocaleString()} ea.`
                      : 'Price TBD'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 w-24">
                  <p className="text-sm font-bold text-slate-900">
                    {item.subtotal != null ? `₦${Number(item.subtotal).toLocaleString()}` : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              {hasUnpriced ? '⚠ Some items are unpriced — total is partial' : 'Total'}
            </p>
            <p className="text-sm font-bold text-slate-900">
              {totalKnown > 0 ? `₦${Number(totalKnown).toLocaleString()}${hasUnpriced ? '+' : ''}` : 'TBD'}
            </p>
          </div>
        </div>

        {/* ── Bank accounts (show when confirmed or admin) ── */}
        {(order.status === 'confirmed' || isAdmin) && banks.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment details</p>
            </div>
            <div className="divide-y divide-slate-100">
              {banks.map(b => (
                <div key={b.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{b.account_number}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.account_name} · {b.bank_name}</p>
                  </div>
                  {b.is_primary && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Primary</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Admin action buttons ── */}
        {isAdmin && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Actions</p>
            <div className="flex flex-wrap gap-2">
              {order.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus('confirmed')} disabled={actioning}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                    ✓ Confirm order
                  </button>
                  <button onClick={() => updateStatus('rejected')} disabled={actioning}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                    ✕ Reject
                  </button>
                </>
              )}
              {order.status === 'confirmed' && (
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <select value={dispatchLoc} onChange={e => setDispatchLoc(e.target.value)} disabled={actioning}
                    className="bg-transparent text-sm font-medium text-slate-700 px-2 focus:outline-none min-w-[120px]">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                  </select>
                  <button onClick={() => updateStatus('dispatched')} disabled={actioning || !dispatchLoc}
                    className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
                    🚚 Mark dispatched
                  </button>
                </div>
              )}
              {order.status === 'dispatched' && (
                <button onClick={() => updateStatus('delivered')} disabled={actioning}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                  📦 Mark delivered
                </button>
              )}
              {(order.status === 'delivered' || order.status === 'rejected') && (
                <p className="text-xs text-slate-400 italic">No further actions available.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Message thread ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Messages</p>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">
                No messages yet. Start the conversation below.
              </p>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_id === profile.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-sm rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-slate-900 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1 opacity-60">{msg.sender_name}</p>
                    )}
                    {msg.image_url && (
                      <a href={msg.image_url} target="_blank" rel="noreferrer">
                        <img src={msg.image_url} alt="Attachment" className="max-w-full h-auto rounded-xl mb-2 max-h-48 object-cover border border-slate-200" />
                      </a>
                    )}
                    {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                    <p className={`text-xs mt-1 ${isMe ? 'text-slate-400' : 'text-slate-400'}`}>
                      {timeStr(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Message input */}
          <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-2">
            {imageFile && (
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl text-sm border border-slate-200 w-fit">
                <span className="text-slate-600 truncate max-wxs">📎 {imageFile.name}</span>
                <button onClick={() => setImageFile(null)} className="text-slate-400 hover:text-red-500 font-bold">✕</button>
              </div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2 items-center">
              <label className="cursor-pointer p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <input type="file" className="hidden" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
              </label>
              <input
                type="text"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder={
                  isAdmin
                    ? 'Message optician… e.g. "Please pay within 24hrs"'
                    : 'Send a message… e.g. "Payment sent, ref: GTB123"'
                }
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
              />
              <button type="submit" disabled={sending || (!msgText.trim() && !imageFile)}
                className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 h-full flex items-center">
                {sending ? '…' : 'Send'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </Layout>
  )
}
