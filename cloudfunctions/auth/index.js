const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) { return { ok: true, data } }
function fail(message, code = 'AUTH_ERROR') { return { ok: false, message, code } }

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail('未能获取微信身份，请稍后重试')
  if (event.action !== 'login') return fail('不支持的操作', 'INVALID_ACTION')

  try {
    const userRef = db.collection('users').doc(OPENID)
    let user
    try {
      user = (await userRef.get()).data
    } catch (error) {
      user = null
    }

    if (!user) {
      const newUser = {
        nickname: `小饭鸭${OPENID.slice(-2).toUpperCase()}`,
        avatarUrl: '',
        preferences: [],
        roomId: '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      await userRef.set({ data: newUser })
      user = (await userRef.get()).data
    }

    let room = null
    if (user.roomId) {
      try {
        room = (await db.collection('rooms').doc(user.roomId).get()).data
        if (!room || room.status === 'dissolved') {
          room = null
          await userRef.update({ data: { roomId: '', updatedAt: db.serverDate() } })
          user.roomId = ''
        }
      } catch (error) {
        await userRef.update({ data: { roomId: '', updatedAt: db.serverDate() } })
        user.roomId = ''
      }
    }

    return ok({ user, room })
  } catch (error) {
    console.error('auth.login', error)
    return fail('登录失败，请检查云环境配置')
  }
}
