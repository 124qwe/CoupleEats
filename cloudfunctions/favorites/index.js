const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const colors = ['#f8dce7', '#fff0bd', '#dfeaff', '#e4efcd', '#f7d7be']
const allowedCategories = ['hotpot', 'japanese', 'home', 'bbq', 'fast', 'dessert']

function ok(data) { return { ok: true, data } }
function fail(message, code = 'FAVORITE_ERROR') { return { ok: false, message, code } }

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

function clean(input = {}) {
  const name = String(input.name || '').trim().slice(0, 18)
  const emoji = String(input.emoji || '📍').trim().slice(0, 4) || '📍'
  const category = allowedCategories.includes(input.category) ? input.category : 'home'
  const desc = String(input.desc || '').trim().slice(0, 36)
  return { name, emoji, category, desc }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const ctx = await context(OPENID)
  if (!ctx) return fail('请先绑定饭搭子再使用共同收藏', 'NO_ROOM')

  try {
    const collection = db.collection('favorites')
    if (event.action === 'list') {
      const result = await collection.where({ roomId: ctx.room._id }).orderBy('createdAt', 'desc').limit(100).get()
      return ok({ favorites: result.data })
    }

    if (event.action === 'create') {
      const favorite = clean(event.favorite)
      if (!favorite.name) return fail('给这份收藏起个名字吧', 'INVALID_NAME')
      const count = await collection.where({ roomId: ctx.room._id }).count()
      if (count.total >= 100) return fail('收藏已经满 100 个啦，先整理一下吧', 'LIMIT_REACHED')
      const data = {
        ...favorite,
        roomId: ctx.room._id,
        createdBy: OPENID,
        color: colors[count.total % colors.length],
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const added = await collection.add({ data })
      return ok({ favorite: { _id: added._id, ...data } })
    }

    const id = String(event.id || '')
    if (!id) return fail('缺少收藏编号', 'INVALID_ID')
    let existing
    try { existing = (await collection.doc(id).get()).data } catch (error) { return fail('这份收藏已经不存在了', 'NOT_FOUND') }
    if (existing.roomId !== ctx.room._id) return fail('不能修改其他房间的收藏', 'FORBIDDEN')

    if (event.action === 'update') {
      const favorite = clean(event.favorite)
      if (!favorite.name) return fail('给这份收藏起个名字吧', 'INVALID_NAME')
      await collection.doc(id).update({ data: { ...favorite, updatedAt: db.serverDate() } })
      return ok({ favorite: { ...existing, ...favorite } })
    }
    if (event.action === 'remove') {
      await collection.doc(id).remove()
      return ok({ id })
    }
    return fail('不支持的操作', 'INVALID_ACTION')
  } catch (error) {
    console.error('favorites.main', error)
    return fail('收藏服务暂时开小差了')
  }
}
