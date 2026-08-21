const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) { return { ok: true, data } }
function fail(message, code = 'ROOM_ERROR') { return { ok: false, message, code } }
function inviteCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0') }

async function getUser(openid) {
  try { return (await db.collection('users').doc(openid).get()).data } catch (error) { return null }
}

async function currentRoom(user) {
  if (!user || !user.roomId) return null
  try {
    const room = (await db.collection('rooms').doc(user.roomId).get()).data
    return room && room.status !== 'dissolved' ? room : null
  } catch (error) { return null }
}

async function createRoom(openid, user) {
  const existing = await currentRoom(user)
  if (existing) return ok({ room: existing })

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = inviteCode()
    const duplicate = await db.collection('rooms').where({ inviteCode: code }).limit(1).count()
    if (duplicate.total) continue
    const now = new Date()
    const room = {
      inviteCode: code,
      creatorOpenid: openid,
      status: 'waiting',
      members: [{ openid, nickname: user.nickname || '小饭鸭', avatarUrl: user.avatarUrl || '', joinedAt: now }],
      lastDecisionBy: '',
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
    let added = null
    try {
      added = await db.collection('rooms').add({ data: room })
      await db.collection('users').doc(openid).update({ data: { roomId: added._id, updatedAt: db.serverDate() } })
      return ok({ room: { _id: added._id, ...room } })
    } catch (error) {
      // 用户记录更新失败时清理孤立房间，再换一个邀请码重试。
      if (added && added._id) await db.collection('rooms').doc(added._id).remove().catch(() => null)
      console.warn('create room retry', attempt, error.errCode || error.message)
    }
  }
  return fail('邀请码生成失败，请稍后再试')
}

async function joinRoom(openid, user, code) {
  if (!/^\d{6}$/.test(code || '')) return fail('请输入正确的 6 位邀请码', 'INVALID_CODE')
  const existing = await currentRoom(user)
  if (existing) return fail('你已经在一间房里了', 'ALREADY_BOUND')

  const query = await db.collection('rooms').where({ inviteCode: code }).limit(1).get()
  if (!query.data.length) return fail('没有找到这个邀请码，可能已经失效了', 'CODE_NOT_FOUND')
  const target = query.data[0]
  if (target.status !== 'waiting') return fail('这个邀请码已经使用过了', 'CODE_USED')
  if (target.expiresAt && new Date(target.expiresAt).getTime() < Date.now()) return fail('邀请码已过期，请让 TA 重新生成', 'CODE_EXPIRED')
  if ((target.members || []).some(member => member.openid === openid)) return ok({ room: target })
  if ((target.members || []).length >= 2) return fail('这个房间已经坐满啦', 'ROOM_FULL')

  try {
    await db.runTransaction(async transaction => {
      const roomRef = transaction.collection('rooms').doc(target._id)
      const userRef = transaction.collection('users').doc(openid)
      const freshRoom = (await roomRef.get()).data
      const freshUser = (await userRef.get()).data
      if (freshUser.roomId) throw new Error('ALREADY_BOUND')
      if (freshRoom.status !== 'waiting' || freshRoom.members.length >= 2) throw new Error('ROOM_FULL')
      const members = [...freshRoom.members, { openid, nickname: user.nickname || '小饭鸭', avatarUrl: user.avatarUrl || '', joinedAt: new Date() }]
      await roomRef.update({ data: { members, status: 'active', updatedAt: new Date() } })
      await userRef.update({ data: { roomId: target._id, updatedAt: new Date() } })
    })
    const room = (await db.collection('rooms').doc(target._id).get()).data
    return ok({ room })
  } catch (error) {
    console.error('room.join', error)
    if (error.message === 'ROOM_FULL') return fail('来晚一步，这个房间已经坐满啦', 'ROOM_FULL')
    if (error.message === 'ALREADY_BOUND') return fail('你已经在一间房里了', 'ALREADY_BOUND')
    return fail('绑定失败，请重新试一次')
  }
}

async function leaveRoom(openid, user) {
  const room = await currentRoom(user)
  if (!room) {
    await db.collection('users').doc(openid).update({ data: { roomId: '', updatedAt: db.serverDate() } })
    return ok({ room: null })
  }
  const memberIds = (room.members || []).map(member => member.openid)
  await Promise.all(memberIds.map(id => db.collection('users').doc(id).update({ data: { roomId: '', updatedAt: db.serverDate() } }).catch(() => null)))
  await db.collection('rooms').doc(room._id).update({
    data: { status: 'dissolved', inviteCode: `${room.inviteCode}-${Date.now()}`, dissolvedBy: openid, dissolvedAt: db.serverDate(), updatedAt: db.serverDate() }
  })
  return ok({ room: null })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const user = await getUser(OPENID)
  if (!user) return fail('请先重新进入小程序完成登录', 'NOT_LOGGED_IN')

  try {
    switch (event.action) {
      case 'get': return ok({ room: await currentRoom(user) })
      case 'create': return createRoom(OPENID, user)
      case 'join': return joinRoom(OPENID, user, String(event.inviteCode || '').trim())
      case 'leave': return leaveRoom(OPENID, user)
      default: return fail('不支持的操作', 'INVALID_ACTION')
    }
  } catch (error) {
    console.error('room.main', error)
    return fail('房间服务暂时开小差了')
  }
}
