// Lists all landing page sign-ups and the totals per role.
// Run from the repo root: npm run pilot-requests
import { supabaseAdmin } from '../src/supabase.js'

if (!supabaseAdmin) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in server/.env to read pilot requests.')
  process.exit(1)
}

const { data, error } = await supabaseAdmin
  .from('pilot_requests')
  .select('created_at, role, email, company, interns_per_year, field, has_placement, applications_sent, help_wanted, needed_by, variant')
  .order('created_at', { ascending: false })

if (error) {
  console.error('Could not load pilot requests:', error.message)
  process.exit(1)
}

console.table(
  data.map((r) => ({
    date: new Date(r.created_at).toLocaleString('en-GB'),
    role: r.role,
    email: r.email,
    company: r.company ?? '',
    interns_per_year: r.interns_per_year ?? '',
    field: r.field ?? '',
    has_place: r.has_placement ?? '',
    applications: r.applications_sent ?? '',
    help: (r.help_wanted ?? []).join(', '),
    needed_by: r.needed_by ?? '',
  })),
)

const count = (role) => data.filter((r) => r.role === role).length
console.log(`Pilot requests (companies): ${count('company')}`)
console.log(`Student sign-ups: ${count('student')}`)
console.log(`Mentor sign-ups: ${count('mentor')}`)
console.log(`Total: ${data.length}`)

// Follow-up answers from students
const answered = data.filter(
  (r) => r.role === 'student' && (r.has_placement || r.applications_sent || r.help_wanted || r.needed_by),
)
if (answered.length) {
  const tally = (key) =>
    answered.reduce((acc, r) => {
      for (const value of [].concat(r[key] ?? [])) acc[value] = (acc[value] ?? 0) + 1
      return acc
    }, {})
  console.log(`\nStudents who answered the follow-up questions: ${answered.length} of ${count('student')}`)
  console.log('Already have a place:', tally('has_placement'))
  console.log('Applications sent:', tally('applications_sent'))
  console.log('Help wanted:', tally('help_wanted'))
  console.log('Internship needed within (months):', tally('needed_by'))
}

// A/B test: student sign-ups per hero headline variant (visits per variant are in GoatCounter: ab/hero-a, ab/hero-b)
const perVariant = (v) => data.filter((r) => r.role === 'student' && r.variant === v).length
console.log(`\nA/B test, student sign-ups: variant A ${perVariant('a')} · variant B ${perVariant('b')}`)

// Contact form messages
const { data: messages, error: messagesError } = await supabaseAdmin
  .from('contact_messages')
  .select('created_at, name, email, message')
  .order('created_at', { ascending: false })
if (messagesError) console.log(`\nContact messages: not available (${messagesError.message})`)
else {
  console.log(`\nContact messages: ${messages.length}`)
  for (const m of messages) {
    console.log(`- ${new Date(m.created_at).toLocaleString('en-GB')} ${m.name} <${m.email}>: ${m.message}`)
  }
}
