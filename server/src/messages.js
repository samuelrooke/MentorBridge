// Deleting messages. Both people in a match see "Message deleted" in its place; the
// text and the picture are removed. Used by the unsend route (own message, within the
// window) and the admin route (any message).

/** How long after sending you can still delete your own message. The client shows the same. */
export const UNSEND_WINDOW_MS = 60 * 60 * 1000

export function canUnsend(message, userId, now = Date.now()) {
  if (!message || message.deleted_at) return false
  if (message.sender_id !== userId) return false
  return now - new Date(message.created_at).getTime() <= UNSEND_WINDOW_MS
}

export async function deleteMessage(db, message, deletedBy) {
  if (message.attachment_path) {
    await db.storage.from('message-attachments').remove([message.attachment_path])
  }
  await db.from('message_reactions').delete().eq('message_id', message.id)
  const { error } = await db.from('messages').update({
    body: '',
    attachment_path: null,
    attachment_type: null,
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
  }).eq('id', message.id)
  if (error) throw error
}
