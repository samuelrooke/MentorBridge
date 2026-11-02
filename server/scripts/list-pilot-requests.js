// Lists all pilot requests and the total count.
// Run from the repo root: npm run pilot-requests
import { supabaseAdmin } from '../src/supabase.js'

if (!supabaseAdmin) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in server/.env to read pilot requests.')
  process.exit(1)
}

const { data, count, error } = await supabaseAdmin
  .from('pilot_requests')
  .select('created_at, email, company, interns_per_year', { count: 'exact' })
  .order('created_at', { ascending: false })

if (error) {
  console.error('Could not load pilot requests:', error.message)
  process.exit(1)
}

console.table(
  data.map((r) => ({
    date: new Date(r.created_at).toLocaleString('en-GB'),
    email: r.email,
    company: r.company,
    interns_per_year: r.interns_per_year,
  })),
)
console.log(`Total pilot requests: ${count}`)
