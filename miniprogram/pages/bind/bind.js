const app = getApp()

Page({
  data: {
    mode: 'create',
    inviteCode: '',
    room: null,
    user: null,
    submitting: false,
    meInitial: '我',
    partnerInitial: 'TA',
    meName: '我',
    partnerName: 'TA'
  },

  async onLoad(options) {
    if (options.code) this.setData({ mode: 'join', inviteCode: String(options.code).slice(0, 6) })
    try {
      const data = await app.ensureLogin()
      this.applyRoom(data.user, data.room)
    } catch (err) {
      app.showError(err)
    }
  },

  onShow() {
    if (this.loaded) this.refreshRoom(true)
  },

  applyRoom(user, room) {
    const members = room && room.members || []
    const me = members.find(member => member.openid === user._id)
    const partner = members.find(member => member.openid !== user._id)
    this.setData({
      user,
      room: room || null,
      meInitial: (me && me.nickname || user.nickname || '我').slice(0, 1),
      partnerInitial: (partner && partner.nickname || 'TA').slice(0, 1),
      meName: me && me.nickname || user.nickname || '我',
      partnerName: partner && partner.nickname || 'TA'
    })
    this.loaded = true
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode })
  },

  onCodeInput(event) {
    const inviteCode = String(event.detail.value || '').replace(/\D/g, '').slice(0, 6)
    this.setData({ inviteCode })
  },

  async createRoom() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const data = await app.callCloud('room', { action: 'create' })
      app.globalData.room = data.room
      this.applyRoom(this.data.user, data.room)
      wx.showToast({ title: '邀请码生成啦', icon: 'success' })
    } catch (err) {
      app.showError(err)
    } finally {
      this.setData({ submitting: false })
    }
  },

  async joinRoom() {
    if (this.data.inviteCode.length !== 6 || this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const data = await app.callCloud('room', { action: 'join', inviteCode: this.data.inviteCode })
      app.globalData.room = data.room
      this.applyRoom(this.data.user, data.room)
      wx.showToast({ title: '绑定成功', icon: 'success' })
    } catch (err) {
      app.showError(err)
    } finally {
      this.setData({ submitting: false })
    }
  },

  async refreshRoom(silent = false) {
    try {
      const data = await app.callCloud('room', { action: 'get' }, { silent })
      app.globalData.room = data.room || null
      this.applyRoom(this.data.user || app.globalData.user, data.room)
      if (!silent && data.room && data.room.status === 'active') wx.showToast({ title: 'TA 已经来啦', icon: 'success' })
      else if (!silent) wx.showToast({ title: '还在等 TA 哦', icon: 'none' })
    } catch (err) {
      if (!silent) app.showError(err)
    }
  },

  copyCode() {
    if (!this.data.room) return
    wx.setClipboardData({ data: this.data.room.inviteCode })
  },

  backHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  onShareAppMessage() {
    const code = this.data.room && this.data.room.inviteCode
    return {
      title: `${this.data.user && this.data.user.nickname || '你的饭搭子'} 邀你一起决定今天吃啥鸭`,
      path: `/pages/bind/bind?code=${code || ''}`,
      imageUrl: '/assets/images/couple-banner.jpg'
    }
  }
})
