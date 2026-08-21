const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function ok(data) { return { ok: true, data } }
function fail(message, code = 'RECORD_ERROR') { return { ok: false, message, code } }

async function context(openid) {
  let user
  try { user = (await db.collection('users').doc(openid).get()).data } catch (error) { return null }
  if (!user.roomId) return null
  try {
    const room = (await db.collection('rooms').doc(user.roomId).get()).data
    if (!room || room.status === 'dissolved' || !(room.members || []).some(item => item.openid === openid)) return null
    return { user, room }
  } catch (error) { return null }
}

function dayStart(now = new Date(), offsetMinutes = 480) {
  const shifted = new Date(now.getTime() + offsetMinutes * 60000)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offsetMinutes * 60000)
}

function weekStart(now = new Date()) {
  const start = dayStart(now)
  const shifted = new Date(start.getTime() + 480 * 60000)
  const weekday = shifted.getUTCDay() || 7
  return new Date(start.getTime() - (weekday - 1) * 86400000)
}

function cleanFood(input = {}) {
  return {
    id: String(input.id || `manual-${Date.now()}`).slice(0, 80),
    cloudId: String(input.cloudId || '').slice(0, 80),
    name: String(input.name || '').trim().slice(0, 24),
    emoji: String(input.emoji || '🍽️').slice(0, 4),
    category: String(input.category || 'other').slice(0, 20),
    color: String(input.color || '#fff0bd').slice(0, 20),
    source: input.source === 'favorite' ? 'favorite' : 'builtin'
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const ctx = await context(OPENID)
  if (!ctx) return fail('请先绑定饭搭子再记录这一餐', 'NO_ROOM')

  try {
    if (event.action === 'addManual') {
      const food = cleanFood(event.food)
      if (!food.name) return fail('还没有选择吃什么', 'INVALID_FOOD')
      const member = ctx.room.members.find(item => item.openid === OPENID)
      const record = {
        roomId: ctx.room._id,
        food,
        decisionType: 'manual',
        decidedBy: OPENID,
        deciderName: member && member.nickname || ctx.user.nickname || '饭搭子',
        eatenAt: db.serverDate(),
        createdAt: db.serverDate()
      }
      const added = await db.collection('records').add({ data: record })
      await db.collection('rooms').doc(ctx.room._id).update({ data: { lastDecisionBy: OPENID, lastDecisionAt: db.serverDate(), updatedAt: db.serverDate() } })
      return ok({ record: { _id: added._id, ...record } })
    }

    if (event.action === 'list') {
      const range = ['today', 'week', 'all'].includes(event.range) ? event.range : 'week'
      const limit = Math.min(Math.max(Number(event.limit) || 50, 1), 100)
      const condition = { roomId: ctx.room._id }
      if (range === 'today') condition.eatenAt = _.gte(dayStart())
      if (range === 'week') condition.eatenAt = _.gte(weekStart())
      const [result, weekCount, totalCount, spinCount] = await Promise.all([
        db.collection('records').where(condition).orderBy('eatenAt', 'desc').limit(limit).get(),
        db.collection('records').where({ roomId: ctx.room._id, eatenAt: _.gte(weekStart()) }).count(),
        db.collection('records').where({ roomId: ctx.room._id }).count(),
        db.collection('records').where({ roomId: ctx.room._id, decisionType: 'spin' }).count()
      ])
      return ok({ records: result.data, stats: { weekCount: weekCount.total, totalCount: totalCount.total, spinCount: spinCount.total } })
    }

    return fail('不支持的操作', 'INVALID_ACTION')
  } catch (error) {
    console.error('records.main', error)
    return fail('日记服务暂时开小差了')
  }
}
