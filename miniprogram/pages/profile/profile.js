const app = getApp()

const preferenceOptions = [
  { id: 'spicy', name: '无辣不欢', emoji: '🌶️' },
  { id: 'light', name: '清淡一点', emoji: '🥬' },
  { id: 'meat', name: '肉肉万岁', emoji: '🥩' },
  { id: 'sweet', name: '甜口选手', emoji: '🍰' },
  { id: 'late', name: '夜宵搭子', emoji: '🌙' },
  { id: 'healthy', name: '今天轻食', emoji: '🥗' }
]

Page({
  data: {
    user: {},
    room: null,
    initial: '鸭',
    partnerInitial: 'TA',
    partnerName: '等 TA 来',
    turnText: '还没有人拍板，第一餐一起决定吧',
    preferenceOptions,
    savingPrefs: false,
    showProfileEditor: false,
    editNickname: '',
    editInitial: '鸭',
    savingProfile: false
  },

  onLoad() { this.loadData() },
  onShow() { if (this.loaded) this.loadData(true) },
  onPullDownRefresh() { this.loadData(true).finally(() => wx.stopPullDownRefresh()) },

  async loadData(silent = false) {
    try {
      const login = await app.ensureLogin()
      let room = login.room || app.globalData.room
      if (room) {
        const data = await app.callCloud('room', { action: 'get' }, { silent: true })
        room = data.room || null
      }
      app.globalData.room = room
      const user = app.globalData.user || login.user
      const partner = room && (room.members || []).find(item => item.openid !== user._id)
      let turnText = '还没有人拍板，第一餐一起决定吧'
      if (room && room.lastDecisionBy) {
        const decider = (room.members || []).find(item => item.openid === room.lastDecisionBy)
        turnText = `上次由 ${decider && decider.nickname || 'TA'} 拍板 · 下次换另一个人`
      }
      const prefs = new Set(user.preferences || [])
      this.setData({
        user,
        room,
        initial: (user.nickname || '鸭').slice(0, 1),
        partnerInitial: (partner && partner.nickname || 'TA').slice(0, 1),
        partnerName: partner && partner.nickname || '等 TA 来',
        turnText,
        preferenceOptions: preferenceOptions.map(item => ({ ...item, selected: prefs.has(item.id) }))
      })
      this.loaded = true
    } catch (err) { if (!silent) app.showError(err) }
  },

  openProfileEditor() {
    const editNickname = this.data.user.nickname || ''
    this.setData({ showProfileEditor: true, editNickname, editInitial: editNickname.slice(0, 1) || '鸭' })
  },
  closeProfileEditor() { if (!this.data.savingProfile) this.setData({ showProfileEditor: false }) },
  noop() {},
  onNicknameInput(event) {
    const editNickname = event.detail.value.trimStart()
    this.setData({ editNickname, editInitial: editNickname.slice(0, 1) || '鸭' })
  },

  async saveProfile() {
    const nickname = this.data.editNickname.trim()
    if (!nickname || this.data.savingProfile) return
    this.setData({ savingProfile: true })
    try {
      const data = await app.callCloud('profile', { action: 'update', profile: { nickname } })
      app.globalData.user = data.user
      if (data.room) app.globalData.room = data.room
      this.setData({ showProfileEditor: false })
      await this.loadData(true)
      wx.showToast({ title: '昵称保存啦', icon: 'success' })
    } catch (err) { app.showError(err) }
    finally { this.setData({ savingProfile: false }) }
  },

  async togglePreference(event) {
    if (this.data.savingPrefs) return
    const id = event.currentTarget.dataset.id
    const options = this.data.preferenceOptions.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    const preferences = options.filter(item => item.selected).map(item => item.id)
    this.setData({ preferenceOptions: options, savingPrefs: true })
    try {
      const data = await app.callCloud('profile', { action: 'update', profile: { preferences } }, { silent: true })
      app.globalData.user = data.user
    } catch (err) {
      app.showError(err)
      await this.loadData(true)
    } finally { this.setData({ savingPrefs: false }) }
  },

  copyCode() { if (this.data.room) wx.setClipboardData({ data: this.data.room.inviteCode }) },
  goBind() { wx.navigateTo({ url: '/pages/bind/bind' }) },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }) },
  goPool() { wx.switchTab({ url: '/pages/pool/pool' }) },

  async unbind() {
    const confirmed = await new Promise(resolve => wx.showModal({
      title: '确定解除关系吗？',
      content: '解除后双方都会离开房间；已有投喂记录会保留在云端，但不再展示。',
      confirmText: '解除',
      confirmColor: '#d36380',
      success: result => resolve(result.confirm), fail: () => resolve(false)
    }))
    if (!confirmed) return
    try {
      await app.callCloud('room', { action: 'leave' })
      app.globalData.room = null
      app.globalData.user = { ...app.globalData.user, roomId: '' }
      app.setCandidates([])
      this.setData({ room: null })
      wx.showToast({ title: '已解除关系', icon: 'success' })
    } catch (err) { app.showError(err) }
  }
})
