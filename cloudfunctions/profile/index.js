const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const allowedPreferences = ['spicy', 'light', 'meat', 'sweet', 'late', 'healthy']

function ok(data) { return { ok: true, data } }
function fail(message, code = 'PROFILE_ERROR') { return { ok: false, message, code } }

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (event.action !== 'update') return fail('不支持的操作', 'INVALID_ACTION')
  let user
  try { user = (await db.collection('users').doc(OPENID).get()).data } catch (error) { return fail('请重新进入小程序登录', 'NOT_LOGGED_IN') }

  try {
    const input = event.profile || {}
    const changes = { updatedAt: db.serverDate() }
    if (Object.prototype.hasOwnProperty.call(input, 'nickname')) {
      const nickname = String(input.nickname || '').trim().slice(0, 12)
      if (!nickname) return fail('昵称不能为空', 'INVALID_NICKNAME')
      changes.nickname = nickname
    }
    if (Array.isArray(input.preferences)) {
      changes.preferences = [...new Set(input.preferences.filter(item => allowedPreferences.includes(item)))].slice(0, 6)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'avatarUrl')) changes.avatarUrl = String(input.avatarUrl || '').slice(0, 500)

    await db.collection('users').doc(OPENID).update({ data: changes })
    let room = null
    if (user.roomId) {
      try {
        room = (await db.collection('rooms').doc(user.roomId).get()).data
        if (room && changes.nickname) {
          const members = (room.members || []).map(member => member.openid === OPENID ? { ...member, nickname: changes.nickname } : member)
          await db.collection('rooms').doc(room._id).update({ data: { members, updatedAt: db.serverDate() } })
          room = { ...room, members }
        }
      } catch (error) { room = null }
    }
    const updatedUser = (await db.collection('users').doc(OPENID).get()).data
    return ok({ user: updatedUser, room })
  } catch (error) {
    console.error('profile.update', error)
    return fail('资料保存失败，请稍后再试')
  }
}
