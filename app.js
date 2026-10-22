// app.js
const { miniProgram } = wx.getAccountInfoSync()

let httptype = ''
let url = ''
let wstype = '' 

switch (miniProgram.envVersion) {
  case 'develop': // 开发版
    httptype = 'http://'
    url = '127.0.0.1:8080' 
    wstype = "ws://"
    break;
  case 'trial': // 体验版
  case 'release': // 正式版
    httptype = 'https://'
    url = 'www.jeremy7.cn' 
    wstype = "wss://"
    break;
  default: 
    httptype = 'https://'
    url = 'www.jeremy7.cn' 
    wstype = "wss://"
    break
}

App({
  onLaunch() {
    this.initUpdateManager();
    var that = this;
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  globalData: {
    userInfo: null,
    httptype,
    url,
    wstype
  },
  request: function(options = {}) {
    var that = this;
    return wx.request({
      url: that.globalData.httptype + that.globalData.url + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      // 统一请求头
      header: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'jeremy63982945'
      },
      success: options.success,
      fail: options.fail,
      complete: options.complete
    });
  },
  initUpdateManager: function() {
    // 旧版客户端不支持更新管理器时，继续正常启动。
    if (typeof wx.getUpdateManager !== 'function') return;

    const updateManager = wx.getUpdateManager();
    // 微信自动检查并下载新版本，下载完成后再提示重启。
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否立即重启小程序？',
        confirmText: '立即更新',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });

    updateManager.onUpdateFailed(() => {
      wx.showModal({
        title: '更新未完成',
        content: '新版本下载失败,请稍后重试。',
        showCancel: false,
        confirmText: '知道了'
      });
    });
  },
  
})
