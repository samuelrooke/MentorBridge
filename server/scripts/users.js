// Manage platform accounts from the command line with the service-role key.
//
//   npm run users                         list all accounts
//   npm run users -- list gmail.com       list accounts whose email contains "gmail.com"
//   npm run users -- delete <email>       delete the account and everything linked to it
//   npm run users -- make-admin <email>   turn an existing account into an admin
//
// delete: removes the login, the profile and, through the database's cascade rules, the
// role answers, read markers and every match the person is in (with its sessions and
// messages). Also removes their profile photo, which the cascade doesn't reach.
//
// make-admin: sets the role to admin and removes the student, mentor or company answers,
// so the admin never shows up in keyword matching. Matches the account is in are kept.
import { supabaseAdmin as db } from '../src/supabase.js'

if (!db) {
  console.error('Needs SUPABASE_SERVICE_ROLE_KEY in server/.env.')
  process.exit(1)
}

const [command = 'list', arg] = process.argv.slice(2)

async function allUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function findByEmail(email) {
  if (!email) throw new Error('Give an email address.')
  const wanted = email.trim().toLowerCase()
  const user = (await allUsers()).find((u) => u.email?.toLowerCase() === wanted)
  if (!user) throw new Error(`No account with ${wanted}.`)
  return user
}

async function list(filter = '') {
  const users = (await allUsers()).filter((u) => (u.email ?? '').toLowerCase().includes(filter.toLowerCase()))
  const { data: profiles } = await db.from('profiles').select('id, role, full_name')
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
  console.table(users.map((u) => ({
    email: u.email,
    role: byId.get(u.id)?.role ?? '(no profile)',
    name: byId.get(u.id)?.full_name ?? '',
    confirmed: Boolean(u.email_confirmed_at),
    created: u.created_at?.slice(0, 10),
    id: u.id,
  })))
}

async function remove(email) {
  const user = await findByEmail(email)
  // created_by on matches has no delete rule, so clear it first or the delete is refused.
  await db.from('matches').update({ created_by: null }).eq('created_by', user.id)
  const { data: files } = await db.storage.from('avatars').list(user.id)
  if (files?.length) await db.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`))
  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) throw error
  console.log(`Deleted ${user.email} (${user.id}).`)
}

async function makeAdmin(email) {
  const user = await findByEmail(email)
  const { error } = await db.from('profiles').update({ role: 'admin' }).eq('id', user.id)
  if (error) throw error
  for (const table of ['student_profiles', 'mentor_profiles', 'company_profiles']) {
    await db.from(table).delete().eq('id', user.id)
  }
  console.log(`${user.email} is now an admin. Log out and in again to see the admin pages.`)
}

const commands = { list: () => list(arg), delete: () => remove(arg), 'make-admin': () => makeAdmin(arg) }
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use list, delete or make-admin.`)
  process.exit(1)
}
try {
  await commands[command]()
} catch (error) {
  console.error(error.message ?? error)
  process.exit(1)
}
