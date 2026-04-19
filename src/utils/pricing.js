import { supabase } from '../supabase'

// Specs is an object: { sph, cyl, axis, addition, name_key }
// Returns the resolved price as a string (or Number) or null if absolutely no price is found.
export async function resolvePrice(productId, companyId, specs) {
  // 1. Try EXACT MATCH
  let qExact = supabase.from('product_prices').select('price').eq('product_id', productId).eq('company_id', companyId)
  if (specs.sph !== null) qExact = qExact.eq('sph', specs.sph); else qExact = qExact.is('sph', null)
  if (specs.cyl !== null) qExact = qExact.eq('cyl', specs.cyl); else qExact = qExact.is('cyl', null)
  if (specs.axis !== null) qExact = qExact.eq('axis', specs.axis); else qExact = qExact.is('axis', null)
  if (specs.addition !== null) qExact = qExact.eq('addition', specs.addition); else qExact = qExact.is('addition', null)
  if (specs.name_key !== null) qExact = qExact.eq('name_key', specs.name_key); else qExact = qExact.is('name_key', null)
  
  const { data: exactRow } = await qExact.maybeSingle()
  if (exactRow?.price != null) return Number(exactRow.price)

  // 2. Try RANGE MATCH
  // Base formatting strings "+100" -> 100, "-075" -> -75, "Plano" -> 0
  const parseNum = (v) => {
    if (!v || v === 'Plano' || v === '-') return 0
    return parseInt(v, 10)
  }
  
  const nSph = specs.sph != null ? parseNum(specs.sph) : null
  const nCyl = specs.cyl != null ? parseNum(specs.cyl) : null
  const nAdd = specs.addition != null ? parseNum(specs.addition) : null

  if (nSph !== null || nCyl !== null || nAdd !== null) {
      // Fetch all ranges for this product
      const { data: ranges } = await supabase.from('product_price_ranges')
        .select('*')
        .eq('product_id', productId).eq('company_id', companyId)
      
      if (ranges && ranges.length > 0) {
        // Find first matching range
        const matchedRange = ranges.find(r => {
           let match = true
           if (nSph !== null) {
             if (r.sph_min !== null && nSph < Number(r.sph_min)) match = false
             if (r.sph_max !== null && nSph > Number(r.sph_max)) match = false
           }
           if (nCyl !== null) {
             if (r.cyl_min !== null && nCyl < Number(r.cyl_min)) match = false
             if (r.cyl_max !== null && nCyl > Number(r.cyl_max)) match = false
           }
           if (nAdd !== null) {
             if (r.add_min !== null && nAdd < Number(r.add_min)) match = false
             if (r.add_max !== null && nAdd > Number(r.add_max)) match = false
           }
           return match
        })
        if (matchedRange?.price != null) return Number(matchedRange.price)
      }
  }

  // 3. Try FALLBACK Base Price
  const { data: baseRow } = await supabase.from('product_prices').select('price')
    .eq('product_id', productId).eq('company_id', companyId)
    .is('sph', null).is('cyl', null).is('axis', null).is('addition', null).is('name_key', null)
    .maybeSingle()
  
  if (baseRow?.price != null) return Number(baseRow.price)

  return null
}
