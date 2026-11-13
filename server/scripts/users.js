// Manage platform accounts from the command line with the service-role key.
//
//   npm run users                         list all accounts
//   npm run users -- list gmail.com       list accounts whose email contains "gmail.com"
//   npm run users -- delete <email>       delete the account and everything linked to it
//   npm run users -- make-admin <email>   turn an existing account into an admin
//
// The same operations are in the admin dashboard (Users tab). See src/accounts.js.
import { allUsers, deleteAccount, findUserByEmail, setRole } from '../src/accounts.js'
import { supabaseAdmin as db } from '../src/supabase.js'

if (!db) {
  console.error('Needs SUPABASE_SERVICE_ROLE_KEY in server/.env.')
  process.exit(1)
}

const [command = 'list', arg] = process.argv.slice(2)

async function list(filter = '') {
  const users = (await allUsers(db)).filter((u) => (u.email ?? '').toLowerCase().includes(filter.toLowerCase()))
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

const commands = {
  list: () => list(arg),
  delete: async () => {
    const user = await findUserByEmail(db, arg)
    await deleteAccount(db, user.id)
    console.log(`Deleted ${user.email} (${user.id}).`)
  },
  'make-admin': async () => {
    const user = await findUserByEmail(db, arg)
    await setRole(db, user.id, 'admin')
    console.log(`${user.email} is now an admin. Log out and in again to see the admin pages.`)
  },
}
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
