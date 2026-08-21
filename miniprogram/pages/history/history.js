const app = getApp()
const { dateKey, friendlyDate, timeText } = require('../../utils/date')

Page({
  data: {
    ranges: [{ id: 'today', name: '今天' }, { id: 'week', name: '本周' }, { id: 'all', name: '全部' }],
    range: 'week',
    loading: true,
    groups: [],
    stats: { weekCount: 0, totalCount: 0, spinCount: 0 }
  },

  onLoad() { this.loadRecords() },
  onPullDownRefresh() { this.loadRecords(true).finally(() => wx.stopPullDownRefresh()) },

  async loadRecords(silent = false) {
    this.setData({ loading: !silent })
    try {
      await app.ensureLogin()
      if (!app.globalData.room) {
        this.setData({ groups: [], loading: false })
        return
      }
      const data = await app.callCloud('records', { action: 'list', range: this.data.range, limit: 100 }, { silent })
      const records = (data.records || []).map(record => ({
        ...record,
        timeText: timeText(record.eatenAt),
        decisionText: record.decisionType === 'spin' ? '幸运转盘抽中' : '自己点菜翻牌',
        deciderText: record.deciderName ? `${record.deciderName} 拍板` : '共同决定'
      }))
      const map = {}
      records.forEach(record => {
        const key = dateKey(record.eatenAt)
        if (!map[key]) map[key] = { date: key, title: friendlyDate(record.eatenAt), records: [] }
        map[key].records.push(record)
      })
      this.setData({ groups: Object.values(map), stats: data.stats || this.data.stats, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      app.showError(err)
    }
  },

  changeRange(event) {
    const range = event.currentTarget.dataset.id
    if (range === this.data.range) return
    this.setData({ range }, () => this.loadRecords())
  },

  goPool() { wx.switchTab({ url: '/pages/pool/pool' }) }
})
