// Account operations that need the service-role key. Used by the admin API routes
// and by `npm run users` (scripts/users.js), so both behave the same.

export const ROLES = ['student', 'mentor', 'company', 'admin']
const ROLE_TABLES = { student: 'student_profiles', mentor: 'mentor_profiles', company: 'company_profiles' }

export async function allUsers(db) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

export async function findUserByEmail(db, email) {
  const wanted = (email ?? '').trim().toLowerCase()
  if (!wanted) throw new Error('Give an email address.')
  const user = (await allUsers(db)).find((u) => u.email?.toLowerCase() === wanted)
  if (!user) throw new Error(`No account with ${wanted}.`)
  return user
}

// Deletes the login and, through the database's cascade rules, the profile, role answers,
// read markers and every match the person is in (with its sessions and messages).
// The profile photo isn't reached by the cascade, so it is removed here.
export async function deleteAccount(db, userId) {
  // created_by on matches has no delete rule, so clear it first or the delete is refused.
  const cleared = await db.from('matches').update({ created_by: null }).eq('created_by', userId)
  if (cleared.error) throw cleared.error
  const { data: files } = await db.storage.from('avatars').list(userId)
  if (files?.length) await db.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`))
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) throw error
}

// Changes the role. Answers that belong to another role are removed, so the person
// only shows up in matching for the role they have now.
export async function setRole(db, userId, role) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}".`)
  const { error } = await db.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
  for (const [tableRole, table] of Object.entries(ROLE_TABLES)) {
    if (tableRole !== role) {
      const removed = await db.from(table).delete().eq('id', userId)
      if (removed.error) throw removed.error
    }
  }
}

export async function confirmEmail(db, userId) {
  const { error } = await db.auth.admin.updateUserById(userId, { email_confirm: true })
  if (error) throw error
}
