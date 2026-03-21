export function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return 'id-' + Math.random().toString(36).slice(2)
}