// pages/weixinpay/weixinpay.js
const app = getApp()

const VIRTUAL_PAYMENT_ERRORS = {
  '1001': '参数错误',
  '-1': '支付失败',
  '-2': '支付已取消',
  '-4': '支付被风控拦截',
  '-5': '开通签约结果未知',
  '-15001': '参数错误，请查看微信返回的具体原因',
  '-15002': '订单号重复，请更换新的订单号后重试',
  '-15003': '系统错误，请稍后重试',
  '-15004': '币种错误，目前只能使用 CNY',
  '-15005': '用户态签名 signature 错误',
  '-15006': '支付签名 paySig 错误',
  '-15007': '用户 session_key 已过期，请重新登录',
  '-15008': '二级商户进件尚未完成',
  '-15009': '代币尚未发布',
  '-15010': '道具 productId 尚未发布',
  '-15011': '现网版本只能使用正式环境 env=0',
  '-15012': '调用支付系统失败导致关单，请更换订单号重试',
  '-15013': '道具价格 goodsPrice 错误',
  '-15014': '道具或代币发布尚未生效，请稍后重试',
  '-15016': 'signData 格式错误',
  '-15017': '商家收款功能因涉嫌违规被限制',
  '-15018': '代币或道具 productId 审核未通过',
  '-15019': '微信支付商户受限，请在商户平台查看原因',
  '-15020': '操作过快，请稍后重试',
  '-15021': '小程序交易请求过于频繁，请稍后重试'
}

Page({

  /**
   * 页面的初始数据
   */
  data: {
     price:"0.01",
     buyQuantity:"1",
     quantityOptions: [1, 2, 5],
     isCustomQuantity: false
  },

  changeprice: function (e){
    this.setData({
      price: e.detail.value
    })
  },

  changebuyQuantity: function (e) {
    this.setData({
      buyQuantity: e.detail.value
    })
  },

  selectQuantity: function (e) {
    this.setData({
      buyQuantity: String(e.currentTarget.dataset.value),
      isCustomQuantity: false
    })
  },

  selectCustomQuantity: function () {
    this.setData({
      buyQuantity: "",
      isCustomQuantity: true
    })
  },


  checkprice: function(){},

  wxPay:function(e){
    var that =  this;
    var price = this.data.price;
    if (price == "0" || price == "") {
      wx.showToast({
        title: "请正确金额",
        icon: 'none',
        duration: 2000
      })
      return;
    }
    wx.showLoading({
      title: '请求中..',
    })
    wx.login({
      success: function (res) {
        if (res.code) {
          //发起网络请求
          app.request({
            url: '/weixinpay/prepay',
            data: {
              wxcode: res.code,
              money: price * 100,
            },
            success: function (res) {
              wx.hideLoading();
              if (res.data.code == "0"){
                var data = res.data.data;
                wx.requestPayment({
                  appId: data.appId,
                  timeStamp: data.timeStamp,
                  nonceStr: data.nonceStr,
                  package: data.package,
                  signType: 'MD5',
                  paySign: data.paySign,
                  success: function (res) {
                    that.payresult(1,res);
                  },
                  fail: function(res){
                    that.payresult(2, res);
                  }
                })
              }else{
                wx.showToast({
                  title: res.data,
                  duration: 2000
                });
              }
            }
          })
        } else {
          console.log('登录失败！' + res.errMsg)
        }
      }  
    })

  },
  wxVirtualPay:function(e) {
    var that = this;
    var buyQuantity = this.data.buyQuantity;
    if (!/^\d+$/.test(buyQuantity) || Number(buyQuantity) <= 0) {
      wx.showToast({
        title: '请输入正确的购买数量',
        icon: 'none'
      })
      return;
    }
    wx.login({
      success: function (res) {
        if (res.code) {
          app.request({
            url: '/weixin/virtual/pay/prepay',
            method:'POST',
            data: {
              buyQuantity:buyQuantity,
              env:0,
              wxCode: res.code,
            },
            success: function (res) {
              if (res.statusCode == 200){
                var data = res.data;
                wx.requestVirtualPayment({
                  // short_series_goods	道具直购
                  //short_series_coin	代币充值
                  mode:"short_series_coin",
                  signData: data.signData,
                  // 支付签名
                  paySig:data.paySig,
                  // 用户态签名
                  signature:data.signature,
                  success(res) {
                    console.log('虚拟支付调用成功', res)
                    wx.showToast({
                      title: '支付成功',
                      icon: 'success'
                    })
                  },
                  fail(error) {
                    console.error(
                      '虚拟支付失败',
                      error.errCode,
                      error.errMsg
                    )
                    that.showVirtualPaymentError(error)
                  },
                })
              }
            }
          });
        }
      },
    })
  },

  showVirtualPaymentError: function (error) {
    var code = error && error.errCode !== undefined
      ? String(error.errCode)
      : '';
    var message = VIRTUAL_PAYMENT_ERRORS[code] || '未知支付错误';
    var rawMessage = error && error.errMsg ? error.errMsg : '';

    if (code === '-2') {
      wx.showToast({
        title: message,
        icon: 'none'
      })
      return;
    }

    if (rawMessage) {
      message += '\n\n微信返回：' + rawMessage;
    }

    wx.showModal({
      title: code ? '支付失败（' + code + '）' : '支付失败',
      content: message,
      showCancel: false,
      confirmText: '我知道了'
    })
  },
  
  payresult:function(code,res){
    if(code ==1){
        msg = "成功"
    }else{
      msg = "失败" + res.errMsg;
    }
  },





  
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})