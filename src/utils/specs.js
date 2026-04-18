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

export const BASE_VALUES = ['Plano',
  ...Array.from({ length: 12 }, (_, i) => String((i + 1) * 100))
]

// Helps parse a displayed Base back to +200 format for database storage if needed
export function dbFormatBase(v) {
  if (!v || v === 'Plano' || v === '-') return v
  return v.startsWith('+') || v.startsWith('-') ? v : '+' + v
}

// Formats +200 back to 200 for 'BASE' display
export function displayFormatBase(v) {
  if (!v || v === 'Plano' || v === '-') return v
  return v.startsWith('+') ? v.slice(1) : v
}
