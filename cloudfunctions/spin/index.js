const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) { return { ok: true, data } }
function fail(message, code = 'SPIN_ERROR') { return { ok: false, message, code } }

async function context(openid) {
  let user
  try { user = (await db.collection('users').doc(openid).get()).data } catch (error) { return null }
  if (!user.roomId) return null
  try {
    const room = (await db.collection('rooms').doc(user.roomId).get()).data
    if (!room || room.status !== 'active' || !(room.members || []).some(item => item.openid === openid)) return null
    return { user, room }
  } catch (error) { return null }
}

function cleanOptions(input) {
  if (!Array.isArray(input)) return []
  const ids = new Set()
  return input.slice(0, 10).reduce((list, item) => {
    const id = String(item.id || '').slice(0, 80)
    const name = String(item.name || '').trim().slice(0, 24)
    if (!id || !name || ids.has(id)) return list
    ids.add(id)
    list.push({
      id,
      cloudId: String(item.cloudId || '').slice(0, 80),
      name,
      emoji: String(item.emoji || '🍽️').slice(0, 4),
      category: String(item.category || 'other').slice(0, 20),
      color: String(item.color || '#fff0bd').slice(0, 20),
      source: item.source === 'favorite' ? 'favorite' : 'builtin'
    })
    return list
  }, [])
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const ctx = await context(OPENID)
  if (!ctx) return fail('请先和饭搭子完成绑定', 'NO_ACTIVE_ROOM')

  try {
    if (event.action === 'draw') {
      const options = cleanOptions(event.options)
      if (options.length < 2) return fail('转盘至少需要两道候选', 'NOT_ENOUGH_OPTIONS')
      const index = crypto.randomInt(0, options.length)
      const result = options[index]
      const member = ctx.room.members.find(item => item.openid === OPENID)
      const spin = {
        roomId: ctx.room._id,
        options,
        result,
        resultIndex: index,
        spunBy: OPENID,
        spunByName: member && member.nickname || ctx.user.nickname || '饭搭子',
        confirmed: false,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const added = await db.collection('spins').add({ data: spin })
      return ok({ spinId: added._id, result })
    }

    if (event.action === 'latest') {
      const result = await db.collection('spins').where({ roomId: ctx.room._id }).orderBy('createdAt', 'desc').limit(1).get()
      return ok({ spin: result.data[0] || null })
    }

    if (event.action === 'confirm') {
      const spinId = String(event.spinId || '')
      let spin
      try { spin = (await db.collection('spins').doc(spinId).get()).data } catch (error) { return fail('这次转盘结果已经找不到了', 'NOT_FOUND') }
      if (spin.roomId !== ctx.room._id) return fail('不能确认其他房间的结果', 'FORBIDDEN')
      if (!spin.confirmed) {
        const member = ctx.room.members.find(item => item.openid === OPENID)
        await db.runTransaction(async transaction => {
          const spinRef = transaction.collection('spins').doc(spinId)
          const freshSpin = (await spinRef.get()).data
          if (!freshSpin || freshSpin.roomId !== ctx.room._id) throw new Error('INVALID_SPIN')
          // 双方同时点确认时，事务冲突会自动重试；重试后只会落一条日记。
          if (freshSpin.confirmed) return
          const now = new Date()
          const record = {
            roomId: ctx.room._id,
            food: freshSpin.result,
            decisionType: 'spin',
            spinId,
            decidedBy: OPENID,
            deciderName: member && member.nickname || ctx.user.nickname || '饭搭子',
            eatenAt: now,
            createdAt: now
          }
          await transaction.collection('records').doc(`spin_${spinId}`).set({ data: record })
          await spinRef.update({ data: { confirmed: true, confirmedBy: OPENID, confirmedAt: now, updatedAt: now } })
          await transaction.collection('rooms').doc(ctx.room._id).update({ data: { lastDecisionBy: OPENID, lastDecisionAt: now, updatedAt: now } })
        })
      }
      const room = (await db.collection('rooms').doc(ctx.room._id).get()).data
      return ok({ room, result: spin.result })
    }

    return fail('不支持的操作', 'INVALID_ACTION')
  } catch (error) {
    console.error('spin.main', error)
    return fail('转盘服务暂时开小差了，请再试一次')
  }
}
