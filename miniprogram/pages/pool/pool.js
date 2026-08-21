const app = getApp()
const { categories, foods, categoryName } = require('../../data/catalog')

const colors = ['#f8dce7', '#fff0bd', '#dfeaff', '#e5f0cd', '#f6d7bd']

Page({
  data: {
    mode: 'eat',
    categories,
    editableCategories: categories.filter(item => !['all', 'favorite'].includes(item.id)),
    activeCategory: 'all',
    keyword: '',
    allFoods: [],
    filteredFoods: [],
    selectedCount: 0,
    showEditor: false,
    editingId: '',
    categoryIndex: 2,
    form: { name: '', emoji: '📍', category: 'home', desc: '' },
    saving: false
  },

  onLoad() {
    this.setData({ mode: wx.getStorageSync('couple-eats-mode') || 'eat' })
    this.mergeFoods([])
  },

  onShow() {
    this.syncSelected()
    this.loadFavorites(true)
  },

  onPullDownRefresh() {
    this.loadFavorites(false).finally(() => wx.stopPullDownRefresh())
  },

  async loadFavorites(silent = true) {
    try {
      await app.ensureLogin()
      if (!app.globalData.room) {
        this.mergeFoods([])
        return
      }
      const data = await app.callCloud('favorites', { action: 'list' }, { silent })
      const favorites = (data.favorites || []).map((item, index) => ({
        id: `favorite-${item._id}`,
        cloudId: item._id,
        name: item.name,
        emoji: item.emoji || '📍',
        category: item.category || 'home',
        categoryName: categoryName(item.category),
        desc: item.desc || '我们收藏的宝藏味道',
        tags: ['收藏', categoryName(item.category)],
        color: item.color || colors[index % colors.length],
        isFavorite: true
      }))
      wx.setStorageSync('couple-eats-favorites', favorites)
      this.mergeFoods(favorites, true)
    } catch (err) {
      if (!silent) app.showError(err)
      this.mergeFoods(wx.getStorageSync('couple-eats-favorites') || [], true)
    }
  },

  mergeFoods(favorites, syncCandidateDetails = false) {
    const selected = app.getCandidates()
    const selectedIds = new Set(selected.map(item => item.id))
    const builtins = foods.map(item => ({ ...item, categoryName: categoryName(item.category), selected: selectedIds.has(item.id) }))
    const favoriteFoods = favorites.map(item => ({ ...item, selected: selectedIds.has(item.id) }))
    const allFoods = [...favoriteFoods, ...builtins]
    if (syncCandidateDetails) {
      const refreshed = selected.map(candidate => {
        const current = allFoods.find(item => item.id === candidate.id)
        return current ? this.toCandidate(current) : candidate
      })
      app.setCandidates(refreshed)
    }
    this.setData({ allFoods }, () => this.applyFilter())
  },

  syncSelected() {
    const selectedIds = new Set(app.getCandidates().map(item => item.id))
    const allFoods = this.data.allFoods.map(item => ({ ...item, selected: selectedIds.has(item.id) }))
    this.setData({ allFoods, selectedCount: selectedIds.size }, () => this.applyFilter())
  },

  applyFilter() {
    const { activeCategory, keyword, allFoods } = this.data
    const normalized = keyword.trim().toLowerCase()
    const filteredFoods = allFoods.filter(item => {
      const categoryMatch = activeCategory === 'all' || (activeCategory === 'favorite' ? item.isFavorite : item.category === activeCategory)
      const text = `${item.name}${item.desc || ''}${(item.tags || []).join('')}`.toLowerCase()
      return categoryMatch && (!normalized || text.includes(normalized))
    })
    this.setData({ filteredFoods, selectedCount: allFoods.filter(item => item.selected).length })
  },

  selectCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.id }, () => this.applyFilter())
  },
  onSearch(event) { this.setData({ keyword: event.detail.value }, () => this.applyFilter()) },
  clearSearch() { this.setData({ keyword: '' }, () => this.applyFilter()) },

  toggleFood(event) {
    const id = event.currentTarget.dataset.id
    const target = this.data.allFoods.find(item => item.id === id)
    if (!target) return
    const selected = this.data.allFoods.filter(item => item.selected)
    if (!target.selected && selected.length >= 10) {
      wx.showToast({ title: '转盘最多放 10 道哦', icon: 'none' })
      return
    }
    const allFoods = this.data.allFoods.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    const candidates = allFoods.filter(item => item.selected).map(this.toCandidate)
    app.setCandidates(candidates)
    wx.vibrateShort({ type: 'light' })
    this.setData({ allFoods }, () => this.applyFilter())
  },

  toCandidate(item) {
    return { id: item.id, cloudId: item.cloudId || '', name: item.name, emoji: item.emoji, category: item.category, color: item.color, source: item.isFavorite ? 'favorite' : 'builtin' }
  },

  clearSelected() {
    app.setCandidates([])
    const allFoods = this.data.allFoods.map(item => ({ ...item, selected: false }))
    this.setData({ allFoods }, () => this.applyFilter())
  },

  goWheel() { wx.switchTab({ url: '/pages/wheel/wheel' }) },

  requireRoom() {
    if (app.globalData.room) return true
    wx.showModal({
      title: '先找到饭搭子',
      content: '绑定后，收藏和每次翻牌都会只属于你们两个人。',
      confirmText: '去绑定',
      success: result => { if (result.confirm) wx.navigateTo({ url: '/pages/bind/bind' }) }
    })
    return false
  },

  async eatNow(event) {
    const item = this.data.allFoods.find(food => food.id === event.currentTarget.dataset.id)
    if (!item || !this.requireRoom()) return
    const confirm = await new Promise(resolve => wx.showModal({
      title: `今天就吃「${item.name}」？`,
      content: '不转也没关系，喜欢就直接翻牌。',
      confirmText: '就它了',
      confirmColor: '#7995da',
      success: result => resolve(result.confirm), fail: () => resolve(false)
    }))
    if (!confirm) return
    try {
      await app.callCloud('records', { action: 'addManual', food: this.toCandidate(item) })
      wx.showToast({ title: '已记进投喂日记', icon: 'success' })
    } catch (err) { app.showError(err) }
  },

  openCreate() {
    if (!this.requireRoom()) return
    this.setData({ showEditor: true, editingId: '', categoryIndex: 2, form: { name: '', emoji: '📍', category: 'home', desc: '' } })
  },

  openEdit(event) {
    const item = this.data.allFoods.find(food => food.id === event.currentTarget.dataset.id)
    if (!item) return
    const index = this.data.editableCategories.findIndex(category => category.id === item.category)
    this.setData({
      showEditor: true,
      editingId: item.cloudId,
      categoryIndex: Math.max(index, 0),
      form: { name: item.name, emoji: item.emoji, category: item.category, desc: item.desc }
    })
  },
  closeEditor() { if (!this.data.saving) this.setData({ showEditor: false }) },
  noop() {},
  onNameInput(event) { this.setData({ 'form.name': event.detail.value.trimStart() }) },
  onEmojiInput(event) { this.setData({ 'form.emoji': event.detail.value }) },
  onDescInput(event) { this.setData({ 'form.desc': event.detail.value.trimStart() }) },
  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    this.setData({ categoryIndex, 'form.category': this.data.editableCategories[categoryIndex].id })
  },

  async saveFavorite() {
    if (!this.data.form.name.trim() || this.data.saving) return
    this.setData({ saving: true })
    try {
      const action = this.data.editingId ? 'update' : 'create'
      await app.callCloud('favorites', {
        action,
        id: this.data.editingId,
        favorite: { ...this.data.form, name: this.data.form.name.trim(), emoji: this.data.form.emoji || '📍' }
      })
      this.setData({ showEditor: false })
      wx.showToast({ title: action === 'create' ? '收藏成功' : '已经改好啦', icon: 'success' })
      await this.loadFavorites(true)
    } catch (err) { app.showError(err) }
    finally { this.setData({ saving: false }) }
  },

  async removeFavorite(event) {
    const item = this.data.allFoods.find(food => food.id === event.currentTarget.dataset.id)
    if (!item) return
    const confirm = await new Promise(resolve => wx.showModal({ title: '移出收藏？', content: `确定删除「${item.name}」吗？`, confirmText: '删除', confirmColor: '#d76683', success: result => resolve(result.confirm), fail: () => resolve(false) }))
    if (!confirm) return
    try {
      await app.callCloud('favorites', { action: 'remove', id: item.cloudId })
      const candidates = app.getCandidates().filter(food => food.id !== item.id)
      app.setCandidates(candidates)
      await this.loadFavorites(true)
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (err) { app.showError(err) }
  }
})
