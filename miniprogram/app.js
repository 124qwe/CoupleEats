const STORAGE_CANDIDATES = 'couple-eats-candidates'

App({
  globalData: {
    user: null,
    room: null,
    loginPromise: null
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后再使用云开发能力', showCancel: false })
      return
    }
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })
    this.ensureLogin()
  },

  ensureLogin(force = false) {
    if (this.globalData.loginPromise && !force) return this.globalData.loginPromise
    this.globalData.loginPromise = this.callCloud('auth', { action: 'login' })
      .then(data => {
        this.globalData.user = data.user
        this.globalData.room = data.room || null
        return data
      })
      .catch(err => {
        this.globalData.loginPromise = null
        throw err
      })
    return this.globalData.loginPromise
  },

  callCloud(name, data = {}, options = {}) {
    if (!wx.cloud) return Promise.reject(new Error('当前微信版本不支持云开发'))
    if (!options.silent) wx.showNavigationBarLoading()
    return wx.cloud.callFunction({ name, data })
      .then(({ result }) => {
        if (!result || result.ok === false) {
          const message = result && result.message ? result.message : '服务暂时开小差了'
          const error = new Error(message)
          error.code = result && result.code
          throw error
        }
        return result.data
      })
      .finally(() => {
        if (!options.silent) wx.hideNavigationBarLoading()
      })
  },

  getCandidates() {
    return wx.getStorageSync(STORAGE_CANDIDATES) || []
  },

  setCandidates(items) {
    wx.setStorageSync(STORAGE_CANDIDATES, items)
  },

  showError(err, fallback = '操作失败，请稍后重试') {
    console.error(err)
    const raw = `${err && (err.message || err.errMsg) || ''}`
    let title = raw || fallback
    if (raw.includes('FUNCTION_NOT_FOUND') || raw.includes('-501000')) {
      title = '云函数未部署，请先在开发者工具上传全部云函数'
    } else if (raw.includes('ENV_NOT_FOUND') || raw.includes('INVALID_ENV')) {
      title = '未找到云环境，请检查开发者工具中的云环境选择'
    } else if (raw.includes('COLLECTION_NOT_EXIST')) {
      title = '数据库集合未创建，请先完成数据库配置'
    }
    wx.showToast({ title, icon: 'none', duration: 2600 })
  }
})
