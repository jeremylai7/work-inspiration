// app.js
const { miniProgram } = wx.getAccountInfoSync()
const ONLINE_COUNT_CACHE_KEY = 'workInspirationOnlineCount';
const DEFAULT_ONLINE_COUNT = 11;

let httptype = ''
let url = ''
let wstype = '' 

switch (miniProgram.envVersion) {
  case 'develop': // 开发版
    httptype = 'http://'
    url = '127.0.0.1:8080' 
    wstype = "ws://"
    // httptype = 'https://'
    // url = 'www.jeremy7.cn' 
    // wstype = "wss://"

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
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    this.loadCachedOnlineCount();
    this.getOpenid().catch(() => {});
  },
  globalData: {
    userInfo: null,
    openid: null,
    onlineCount: DEFAULT_ONLINE_COUNT,
    httptype,
    url,
    wstype
  },
  getOpenid() {
    if (this.globalData.openid) {
      return Promise.resolve(this.globalData.openid);
    }
    if (this.openidRequest) {
      return this.openidRequest;
    } 
    this.openidRequest = new Promise((resolve, reject) => {
      wx.login({
        success: (loginResult) => {
          if (!loginResult.code) {
            reject(new Error('微信登录未返回 code'));
            return;
          }
          this.request({
            url: '/wechat/login',
            data: { code: loginResult.code },
            success: (response) => {
              const openid = typeof response.data === 'string' ? response.data.trim() : '';
              if (response.statusCode !== 200 || !openid) {
                reject(new Error('获取 OpenID 失败'));
                return;
              }
              resolve(openid);
            },
            fail: reject
          });
        },
        fail: reject
      });
    }).then((openid) => {
      this.globalData.openid = openid;
      this.openidRequest = null;
      this.wxConnect();
      return openid;
    }, (error) => {
      this.openidRequest = null;
      throw error;
    });
    return this.openidRequest;
  },
  wxConnect: function() {
    var that = this;
    var openId = that.globalData.openid;
    wx.onSocketOpen((result) => {
      console.log('websocket 已打开...');
      that.startHeartbeat();
    });
    wx.onSocketMessage((result) => {
      if (result.data === 'pong') {
        console.log('收到服务端 pong');
        return;
      }
      const match = typeof result.data === 'string' && /^online:count:(\d+)$/.exec(result.data);
      if (match) {
        const onlineCount = Number(match[1]);
        if (Number.isSafeInteger(onlineCount)) {
          that.updateOnlineCount(onlineCount);
          that.saveCachedOnlineCount(onlineCount);
        }
        return;
      }
      console.log('收到服务端消息：', result.data);
    });
    const handleDisconnect = () => {
      clearInterval(that.heartbeatTimer);
    };
    wx.onSocketClose(handleDisconnect);
    wx.onSocketError(handleDisconnect);
    wx.connectSocket({
      url: that.globalData.wstype + that.globalData.url + "/ws/message/"+openId,
      success:function(res) {
        console.log('websocket 已连接...');
      }
    });
  },
  loadCachedOnlineCount: function() {
    try {
      const cachedCount = wx.getStorageSync(ONLINE_COUNT_CACHE_KEY);
      if (Number.isSafeInteger(cachedCount) && cachedCount >= 0) {
        this.updateOnlineCount(cachedCount);
      } else {
        this.saveCachedOnlineCount(DEFAULT_ONLINE_COUNT);
      }
    } catch (error) {
      console.warn('读取在线人数缓存失败', error);
    }
  },
  saveCachedOnlineCount: function(onlineCount) {
    try {
      wx.setStorageSync(ONLINE_COUNT_CACHE_KEY, onlineCount);
    } catch (error) {
      console.warn('保存在线人数缓存失败', error);
    }
  },
  updateOnlineCount: function(onlineCount) {
    this.globalData.onlineCount = onlineCount;
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    if (page && typeof page.updateOnlineCount === 'function') {
      page.updateOnlineCount(onlineCount);
    }
  },
  startHeartbeat: function() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      wx.sendSocketMessage({ data: 'ping' });
    }, 1000);
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
