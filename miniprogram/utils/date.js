function pad(value) { return String(value).padStart(2, '0') }

function toDate(value) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value.$date) return new Date(value.$date)
  return new Date(value)
}

function dateKey(value) {
  const date = toDate(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function friendlyDate(value) {
  const date = toDate(value)
  const now = new Date()
  const key = dateKey(date)
  const today = dateKey(now)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (key === today) return '今天'
  if (key === dateKey(yesterday)) return '昨天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function timeText(value) {
  const date = toDate(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

module.exports = { toDate, dateKey, friendlyDate, timeText }
