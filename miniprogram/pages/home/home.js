const app = getApp()
const { friendlyDate } = require('../../utils/date')

Page({
  data: {
    loading: true,
    user: null,
    room: null,
    coupleTitle: '我们的投喂日记',
    turnText: '你们谁先拍板？',
    candidateCount: 0,
    latest: []
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.setData({ candidateCount: app.getCandidates().length })
    if (this.loadedOnce) this.loadData(true)
  },

  onPullDownRefresh() {
    this.loadData(true).finally(() => wx.stopPullDownRefresh())
  },

  async loadData(silent = false) {
    try {
      const login = await app.ensureLogin(Boolean(silent))
      const user = login.user || app.globalData.user
      let room = login.room || app.globalData.room
      if (silent) {
        const refreshed = await app.callCloud('room', { action: 'get' }, { silent: true })
        room = refreshed.room || null
        app.globalData.room = room
      }
      const viewData = this.roomView(user, room)
      this.setData({ user, room, loading: false, ...viewData })
      this.loadedOnce = true
      if (room) this.loadLatest()
    } catch (err) {
      this.setData({ loading: false })
      if (!silent) app.showError(err, '登录失败')
    }
  },

  roomView(user, room) {
    if (!room) return { coupleTitle: `${user && user.nickname ? user.nickname : '你'}的投喂日记`, turnText: '先选几道候选吧' }
    const members = room.members || []
    const me = members.find(item => item.openid === user._id)
    const partner = members.find(item => item.openid !== user._id)
    const coupleTitle = partner ? `${me && me.nickname || '我'} × ${partner.nickname || 'TA'} 的投喂日记` : '等待饭搭子的投喂日记'
    let turnText = '你们谁先拍板？'
    if (room.lastDecisionBy) turnText = room.lastDecisionBy === user._id ? `下次轮到 ${partner ? partner.nickname || 'TA' : 'TA'}` : '这次轮到你拍板'
    return { coupleTitle, turnText }
  },

  async loadLatest() {
    try {
      const data = await app.callCloud('records', { action: 'list', range: 'week', limit: 3 }, { silent: true })
      this.setData({
        latest: (data.records || []).slice(0, 3).map(item => ({ ...item, dateText: friendlyDate(item.eatenAt) }))
      })
    } catch (err) {
      console.warn('最近记录加载失败', err)
    }
  },

  goBind() { wx.navigateTo({ url: '/pages/bind/bind' }) },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }) },
  goWheel() { wx.switchTab({ url: '/pages/wheel/wheel' }) },
  chooseMode(event) {
    const mode = event.currentTarget.dataset.mode
    wx.setStorageSync('couple-eats-mode', mode)
    wx.switchTab({ url: '/pages/pool/pool' })
  },
  copyCode() {
    if (!this.data.room) return
    wx.setClipboardData({ data: this.data.room.inviteCode })
  }
})
