import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf8')
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function check() {
  const { data: cols } = await supabase.from('debtors').select('*').limit(1)
  console.log("Debtors columns:", cols ? Object.keys(cols[0]) : "No data")

  const { data: cols2 } = await supabase.from('transactions').select('*').limit(1)
  console.log("Trans columns:", cols2 ? Object.keys(cols2[0]) : "No data")

  const { data: buckets } = await supabase.storage.listBuckets()
  console.log("Buckets:", buckets?.map(b => b.name))
}
check()
