export const SPH_VALUES = ['Plano',
  ...Array.from({ length: 80 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 80 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
]

export const CYL_VALUES = ['-', '+000',
  ...Array.from({ length: 16 }, (_, i) => '-' + String((i + 1) * 25).padStart(3, '0')),
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]

export const AXIS_VALUES = ['-', '90', '180']

export const ADD_VALUES  = ['-',
  ...Array.from({ length: 16 }, (_, i) => '+' + String((i + 1) * 25).padStart(3, '0')),
]

// Addition values for semi-finished blanks (base_add) — unsigned, no '+' sign.
// Finished lenses (sph_add, sph_cyl_axis_add) keep ADD_VALUES with '+' signs.
export const BASE_ADD_VALUES = Array.from({ length: 16 }, (_, i) => String((i + 1) * 25))

// Base values for semi-finished blanks: stored and displayed as unsigned whole numbers.
// 'Plano' is included first for products with zero base power.
export const BASE_VALUES = ['Plano', ...Array.from({ length: 12 }, (_, i) => String((i + 1) * 100))]

// Normalise a Base value to unsigned whole-number format for DB storage.
// Strips any leading '+' sign so that '+200' and '200' both become '200'.
export function dbFormatBase(v) {
  if (!v || v === 'Plano' || v === '-') return v
  return v.startsWith('+') ? v.slice(1) : v
}

// Alias used explicitly in import / migration contexts.
export const normalizeBase = dbFormatBase

// displayFormatBase kept for backward-compat — now a no-op since storage == display.
export function displayFormatBase(v) {
  if (!v || v === 'Plano' || v === '-') return v
  return v.startsWith('+') ? v.slice(1) : v
}
// Normalize addition for semi-finished blanks (base_add) — strip '+' sign.
// Finished lenses are left unchanged.
export function dbFormatAddition(v, isBase) {
  if (!v || v === '-') return v
  if (!isBase) return v
  return v.startsWith('+') ? v.slice(1) : v
}
