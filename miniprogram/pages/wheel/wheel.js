const app = getApp()
const { foods } = require('../../data/catalog')
const { shuffle } = require('../../utils/helpers')

const palette = ['#f9d9e5', '#fff0bd', '#dce9ff', '#dcecc7', '#ffd9bd', '#e7dcf6', '#cfeaed', '#ffe1a8', '#d7e6c0', '#f4c9c3']
const TAU = Math.PI * 2

Page({
  data: {
    candidates: [],
    user: null,
    room: null,
    turnText: '你们谁先拍板？',
    spinning: false,
    showResult: false,
    syncedResult: false,
    resultConfirmed: false,
    confirming: false,
    result: {},
    spinId: ''
  },

  onLoad() {
    this.rotation = 0
  },

  onReady() {
    this.setupCanvas()
  },

  async onShow() {
    const candidates = app.getCandidates()
    if (candidates.length < 2) {
      this.canvas = null
      this.context = null
    }
    this.setData({ candidates }, () => {
      if (candidates.length >= 2) {
        if (this.context) this.drawWheel(this.rotation || 0)
        else wx.nextTick(() => this.setupCanvas())
      }
    })
    try {
      const login = await app.ensureLogin()
      let room = login.room || app.globalData.room
      if (room) {
        const data = await app.callCloud('room', { action: 'get' }, { silent: true })
        room = data.room || room
        app.globalData.room = room
      }
      this.setData({ user: login.user, room, turnText: this.getTurnText(login.user, room) })
    } catch (err) { console.warn(err) }
  },

  onPullDownRefresh() {
    this.syncLatest().finally(() => wx.stopPullDownRefresh())
  },

  getTurnText(user, room) {
    if (!room || room.status !== 'active') return '绑定后和 TA 一起开奖'
    const partner = (room.members || []).find(item => item.openid !== user._id)
    if (!room.lastDecisionBy) return '第一轮，你们谁先来？'
    return room.lastDecisionBy === user._id ? `这次建议让 ${partner && partner.nickname || 'TA'} 来抽` : '这次轮到你来抽啦'
  },

  setupCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#wheelCanvas').fields({ node: true, size: true }).exec(result => {
      if (!result[0] || !result[0].node) return
      const canvas = result[0].node
      const context = canvas.getContext('2d')
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio
      const width = result[0].width
      const height = result[0].height
      canvas.width = width * dpr
      canvas.height = height * dpr
      context.scale(dpr, dpr)
      this.canvas = canvas
      this.context = context
      this.canvasWidth = width
      this.canvasHeight = height
      this.drawWheel(this.rotation || 0)
    })
  },

  drawWheel(rotation = 0) {
    const context = this.context
    const candidates = this.data.candidates
    if (!context || !candidates.length) return
    const width = this.canvasWidth
    const height = this.canvasHeight
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 7
    const arc = TAU / candidates.length
    context.clearRect(0, 0, width, height)
    context.save()
    context.translate(centerX, centerY)
    context.rotate(rotation)
    candidates.forEach((item, index) => {
      const start = -Math.PI / 2 + index * arc
      const end = start + arc
      context.beginPath()
      context.moveTo(0, 0)
      context.arc(0, 0, radius, start, end)
      context.closePath()
      context.fillStyle = item.color || palette[index % palette.length]
      context.fill()
      context.lineWidth = 2
      context.strokeStyle = '#fffef8'
      context.stroke()

      context.save()
      context.rotate(start + arc / 2)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#25304c'
      const emojiSize = candidates.length > 8 ? 15 : 20
      const nameSize = candidates.length > 8 ? 10 : 13
      context.font = `${emojiSize}px sans-serif`
      context.fillText(item.emoji || '🍽️', radius * .68, -8)
      context.font = `700 ${nameSize}px sans-serif`
      const name = item.name.length > 5 ? `${item.name.slice(0, 5)}…` : item.name
      context.fillText(name, radius * .68, 13)
      context.restore()
    })
    context.beginPath()
    context.arc(0, 0, radius, 0, TAU)
    context.lineWidth = 6
    context.strokeStyle = '#2d3651'
    context.stroke()
    context.restore()
  },

  requireActiveRoom() {
    if (this.data.room && this.data.room.status === 'active') return true
    wx.showModal({
      title: '先和 TA 绑定吧',
      content: '云端转盘会保证你们看到同一个结果，绑定后才能一起开奖。',
      confirmText: '去绑定',
      success: result => { if (result.confirm) wx.navigateTo({ url: '/pages/bind/bind' }) }
    })
    return false
  },

  async spin() {
    if (this.data.spinning || this.data.candidates.length < 2 || !this.requireActiveRoom()) return
    this.setData({ spinning: true, showResult: false })
    try {
      const data = await app.callCloud('spin', { action: 'draw', options: this.data.candidates })
      await this.animateTo(data.result)
      this.setData({
        spinning: false,
        result: data.result,
        spinId: data.spinId,
        syncedResult: false,
        resultConfirmed: false,
        showResult: true
      })
      wx.vibrateLong()
    } catch (err) {
      this.setData({ spinning: false })
      app.showError(err)
    }
  },

  animateTo(result) {
    return new Promise(resolve => {
      const index = this.data.candidates.findIndex(item => item.id === result.id)
      if (index < 0 || !this.canvas) { resolve(); return }
      const arc = TAU / this.data.candidates.length
      const desired = ((-(index + .5) * arc) % TAU + TAU) % TAU
      const current = this.rotation || 0
      const aligned = desired + Math.ceil((current - desired) / TAU) * TAU
      const target = aligned + TAU * 6
      const start = Date.now()
      const duration = 4300
      const frame = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        this.rotation = current + (target - current) * eased
        this.drawWheel(this.rotation)
        if (progress < 1) this.canvas.requestAnimationFrame(frame)
        else resolve()
      }
      this.canvas.requestAnimationFrame(frame)
    })
  },

  async confirmResult() {
    if (this.data.resultConfirmed) {
      this.setData({ showResult: false })
      wx.showToast({ title: '一起好好吃饭吧', icon: 'none' })
      return
    }
    if (!this.data.spinId || this.data.confirming) return
    this.setData({ confirming: true })
    try {
      const data = await app.callCloud('spin', { action: 'confirm', spinId: this.data.spinId })
      if (data.room) {
        app.globalData.room = data.room
        this.setData({ room: data.room, turnText: this.getTurnText(this.data.user, data.room) })
      }
      this.setData({ showResult: false })
      wx.showModal({ title: '翻牌成功 🎉', content: `${this.data.result.name} 已写进今天的投喂日记，去好好吃饭吧！`, showCancel: false, confirmText: '好耶' })
    } catch (err) { app.showError(err) }
    finally { this.setData({ confirming: false }) }
  },

  closeResult() { this.setData({ showResult: false }) },
  retry() { this.setData({ showResult: false }, () => this.changeBatch()) },
  noop() {},
  goPool() { wx.switchTab({ url: '/pages/pool/pool' }) },

  changeBatch() {
    if (this.data.spinning) return
    const favorites = wx.getStorageSync('couple-eats-favorites') || []
    const favoriteIds = new Set(favorites.map(item => item.id))
    const all = [...favorites, ...foods.filter(item => !favoriteIds.has(item.id))]
    const count = Math.max(4, Math.min(this.data.candidates.length || 6, 8))
    const candidates = shuffle(all).slice(0, count).map(item => ({
      id: item.id,
      cloudId: item.cloudId || '',
      name: item.name,
      emoji: item.emoji,
      category: item.category,
      color: item.color,
      source: item.isFavorite ? 'favorite' : 'builtin'
    }))
    app.setCandidates(candidates)
    this.rotation = 0
    this.setData({ candidates, showResult: false }, () => this.drawWheel(0))
    wx.showToast({ title: '换好啦', icon: 'success' })
  },

  async syncLatest() {
    if (!this.requireActiveRoom()) return
    try {
      const data = await app.callCloud('spin', { action: 'latest' })
      if (!data.spin) {
        wx.showToast({ title: '还没有转盘结果', icon: 'none' })
        return
      }
      const spin = data.spin
      const ids = this.data.candidates.map(item => item.id)
      const sameCandidates = spin.options && spin.options.length === ids.length && spin.options.every(item => ids.includes(item.id))
      if (!sameCandidates) {
        app.setCandidates(spin.options)
        this.rotation = 0
        if (this.data.candidates.length < 2) {
          this.canvas = null
          this.context = null
        }
        await new Promise(resolve => {
          this.setData({ candidates: spin.options }, () => {
            wx.nextTick(() => {
              if (this.context) this.drawWheel(0)
              else this.setupCanvas()
              resolve()
            })
          })
        })
      }
      this.setData({ result: spin.result, spinId: spin._id, syncedResult: true, resultConfirmed: Boolean(spin.confirmed), showResult: true })
    } catch (err) { app.showError(err) }
  }
})
