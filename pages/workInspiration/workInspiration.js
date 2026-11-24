const HOLIDAY_API_URL = 'https://timor.tech/api/holiday/info/';
const DESKTOP_GUIDE_DATE_KEY = 'workInspirationDesktopGuideDate';
const app = getApp();

Page({
  data: {
    statusBarHeight: 20,
    clock: '08:30:56',
    currentDateText: '-- 月 -- 日 星期-',
    todayIncome: '0.000',
    progressPercent: '0.0',
    progressWidth: '0%',
    remainingWorkTime: '',
    desktopGuide: null,
    onlineCount: app.globalData.onlineCount,
    twoSecondAmount: '0.0222',
    bonusPulse: false,
    isWorking: false,
    isDayOff: false,
    dayOffType: '',
    holidayDateKey: '',
    holidayApiLoaded: false,
    apiDayOff: false,
    apiDayOffType: '',
    workStatus: '未到上班时间',
    monthlySalary: '10000',
    workDaysPerMonth: 22,
    morningStart: '09:00',
    morningEnd: '12:00',
    afternoonStart: '13:30',
    afternoonEnd: '18:00',
    salaryHidden: false,
    incomeHidden: false,
    draftMonthlySalary: '10000',
    draftWorkDaysPerMonth: 22,
    draftMorningStart: '09:00',
    draftMorningEnd: '12:00',
    draftAfternoonStart: '13:30',
    draftAfternoonEnd: '18:00',
    isEditingConfig: false,
    configStatus: '已确认',
    isDesktop: false,
    isCompactMode: false,
    compactModePreference: 'auto'
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    const platform = String(deviceInfo.platform || '').toLowerCase();
    const isDesktop = platform === 'windows' || platform === 'mac' || platform === 'devtools';
    const storedPreference = wx.getStorageSync('workInspirationCompactMode');
    const compactModePreference = ['auto', 'compact', 'full'].includes(storedPreference)
      ? storedPreference
      : 'auto';
    const storedConfig = wx.getStorageSync('workInspirationConfig') || {};
    const salaryHidden = typeof storedConfig.salaryHidden === 'boolean'
      ? storedConfig.salaryHidden
      : wx.getStorageSync('salaryHidden') === true;
    const incomeHidden = typeof storedConfig.incomeHidden === 'boolean'
      ? storedConfig.incomeHidden
      : wx.getStorageSync('incomeHidden') === true;
    const config = {
      monthlySalary: storedConfig.monthlySalary || this.data.monthlySalary,
      workDaysPerMonth: this.normalizeWorkDays(storedConfig.workDaysPerMonth, this.data.workDaysPerMonth),
      morningStart: storedConfig.morningStart || this.data.morningStart,
      morningEnd: storedConfig.morningEnd || this.data.morningEnd,
      afternoonStart: storedConfig.afternoonStart || this.data.afternoonStart,
      afternoonEnd: storedConfig.afternoonEnd || this.data.afternoonEnd
    };

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
      isDesktop,
      compactModePreference,
      isCompactMode: this.resolveCompactMode(windowInfo, isDesktop, compactModePreference),
      ...config,
      salaryHidden,
      incomeHidden,
      draftMonthlySalary: config.monthlySalary,
      draftWorkDaysPerMonth: config.workDaysPerMonth,
      draftMorningStart: config.morningStart,
      draftMorningEnd: config.morningEnd,
      draftAfternoonStart: config.afternoonStart,
      draftAfternoonEnd: config.afternoonEnd
    }, () => {
      this.refreshIncomeRate();
      this.updateClock();
      this.updateIncome();
      this.loadRemoteConfig();
    });

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    });

    this.windowResizeHandler = (result) => {
      const nextWindowInfo = result && result.size ? result.size : result;
      this.applyWindowMode(nextWindowInfo || {});
    };
    if (wx.onWindowResize) {
      wx.onWindowResize(this.windowResizeHandler);
    }
  },

  onShow() {
    this.updateOnlineCount(app.globalData.onlineCount);
    this.startTimers();
    clearTimeout(this.desktopGuideDelayTimer);
    if (!this.data.isCompactMode) {
      this.desktopGuideDelayTimer = setTimeout(() => this.showDesktopGuide(), 2500);
    }
  },

  showDesktopGuide() {
    if (this.data.isCompactMode || typeof wx.getMenuButtonBoundingClientRect !== 'function') return;

    const today = this.getDateKey(new Date());
    if (this.desktopGuideDate === today) return;

    const menu = wx.getMenuButtonBoundingClientRect();
    const { windowWidth } = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    if (!menu || !(menu.width > 0 && menu.bottom > 0 && menu.right >= menu.width && windowWidth >= menu.right)) return;

    try {
      if (wx.getStorageSync(DESKTOP_GUIDE_DATE_KEY) === today) return;
      wx.setStorageSync(DESKTOP_GUIDE_DATE_KEY, today);
    } catch (error) {
      console.warn('桌面引导缓存不可用', error);
    }

    const menuRight = windowWidth - menu.right;
    const right = Math.max(10, menuRight);
    const maxWidth = windowWidth - right - 10;
    this.desktopGuideDate = today;
    this.setData({
      desktopGuide: {
        style: `top: ${menu.bottom + 16}px; right: ${right}px; max-width: ${maxWidth}px;`,
        arrowRight: menuRight - right + menu.width * .75
      }
    });
    this.desktopGuideTimer = setTimeout(() => this.hideDesktopGuide(), 5000);
  },

  hideDesktopGuide() {
    clearTimeout(this.desktopGuideDelayTimer);
    clearTimeout(this.desktopGuideTimer);
    if (this.data.desktopGuide) this.setData({ desktopGuide: null });
  },

  updateOnlineCount(onlineCount) {
    this.setData({ onlineCount });
  },

  onHide() {
    this.hideDesktopGuide();
    this.clearTimers();
  },

  onUnload() {
    this.hideDesktopGuide();
    this.clearTimers();
    if (wx.offWindowResize && this.windowResizeHandler) {
      wx.offWindowResize(this.windowResizeHandler);
    }
    this.windowResizeHandler = null;
  },

  resolveCompactMode(windowInfo, isDesktop = this.data.isDesktop, preference = this.data.compactModePreference) {
    if (!isDesktop) return false;
    if (preference === 'compact') return true;
    if (preference === 'full') return false;

    const width = Number(windowInfo.windowWidth || windowInfo.width || 0);
    const height = Number(windowInfo.windowHeight || windowInfo.height || 0);
    return width > 0 && height > 0 && width <= 430 && height <= 540;
  },

  applyWindowMode(windowInfo) {
    const isCompactMode = this.resolveCompactMode(windowInfo);
    if (isCompactMode !== this.data.isCompactMode) {
      this.setData({ isCompactMode });
    }
  },

  normalizeConfigTime(value, fallback) {
    const time = String(value || '').slice(0, 5);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
  },

  normalizeWorkDays(value, fallback = 22) {
    const workDays = Number(value);
    return Number.isInteger(workDays) && workDays >= 1 && workDays <= 31 ? workDays : fallback;
  },

  loadRemoteConfig() {
    // 尚未同步的本地配置优先，避免被服务端旧数据覆盖。
    if (wx.getStorageSync('workInspirationConfigPending')) {
      this.syncRemoteConfig();
      return;
    }
    const configRevision = this.configRevision || 0;
    app.getOpenid().then((openid) => {
      app.request({
        url: `/work-inspiration/config`,
        method: 'GET',
        data: { openid },
        success: (response) => {
          if (configRevision !== (this.configRevision || 0) || this.data.isEditingConfig) return;
          const remoteConfig = response.data;
          const monthlySalary = Number(remoteConfig && remoteConfig.monthlySalary);
          if (response.statusCode !== 200 || !remoteConfig || !Number.isFinite(monthlySalary) || monthlySalary <= 0) {
            return;
          }

          const config = {
            monthlySalary: monthlySalary.toFixed(2).replace(/\.00$/, ''),
            workDaysPerMonth: this.normalizeWorkDays(remoteConfig.workDaysPerMonth, this.data.workDaysPerMonth),
            morningStart: this.normalizeConfigTime(remoteConfig.morningStartTime, this.data.morningStart),
            morningEnd: this.normalizeConfigTime(remoteConfig.morningEndTime, this.data.morningEnd),
            afternoonStart: this.normalizeConfigTime(remoteConfig.afternoonStartTime, this.data.afternoonStart),
            afternoonEnd: this.normalizeConfigTime(remoteConfig.afternoonEndTime, this.data.afternoonEnd),
            salaryHidden: typeof remoteConfig.salaryHidden === 'boolean'
              ? remoteConfig.salaryHidden
              : this.data.salaryHidden,
            incomeHidden: typeof remoteConfig.incomeHidden === 'boolean'
              ? remoteConfig.incomeHidden
              : this.data.incomeHidden
          };

          wx.setStorageSync('workInspirationConfig', config);
          wx.setStorageSync('salaryHidden', config.salaryHidden);
          wx.setStorageSync('incomeHidden', config.incomeHidden);
          this.setData({
            ...config,
            draftMonthlySalary: config.monthlySalary,
            draftWorkDaysPerMonth: config.workDaysPerMonth,
            draftMorningStart: config.morningStart,
            draftMorningEnd: config.morningEnd,
            draftAfternoonStart: config.afternoonStart,
            draftAfternoonEnd: config.afternoonEnd
          }, () => {
            this.refreshIncomeRate();
            this.updateIncome();
            if ((remoteConfig.salaryHidden === null && config.salaryHidden) ||
                (remoteConfig.incomeHidden === null && config.incomeHidden)) {
              this.saveVisibility(config.salaryHidden, config.incomeHidden);
            }
          });
        }
      });
    }, () => {});
  },

  saveRemoteConfig(config, visibilityOnly = false) {
    // 先保存本地，登录或接口不可用也能立即生效。
    try {
      wx.setStorageSync('workInspirationConfigPending', true);
      wx.setStorageSync('workInspirationConfig', config);
    } catch (error) {
      wx.showToast({ title: '本地保存失败，请重试', icon: 'none' });
      return;
    }
    this.configRevision = (this.configRevision || 0) + 1;
    if (visibilityOnly) {
      this.setData({ salaryHidden: config.salaryHidden, incomeHidden: config.incomeHidden });
      this.syncRemoteConfig();
      return;
    }
    this.setData({
      ...config,
      isEditingConfig: false,
      configStatus: '已确认'
    }, () => {
      this.refreshIncomeRate();
      this.updateIncome();
    });
    wx.showToast({ title: '配置已保存', icon: 'success' });

    this.syncRemoteConfig();
  },

  syncRemoteConfig() {
    if (this.configSyncInFlight) return;
    this.configSyncInFlight = true;
    const configRevision = this.configRevision || 0;
    const {
      monthlySalary, workDaysPerMonth, morningStart, morningEnd,
      afternoonStart, afternoonEnd, salaryHidden, incomeHidden
    } = this.data;
    const finish = () => {
      this.configSyncInFlight = false;
      if (configRevision !== (this.configRevision || 0)) this.syncRemoteConfig();
    };
    app.getOpenid().then((openid) => {
      app.request({
        url: '/work-inspiration/config',
        method: 'POST',
        data: {
          openid,
          monthlySalary: Number(monthlySalary),
          workDaysPerMonth: Number(workDaysPerMonth),
          morningStartTime: morningStart,
          morningEndTime: morningEnd,
          afternoonStartTime: afternoonStart,
          afternoonEndTime: afternoonEnd,
          salaryHidden,
          incomeHidden
        },
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300 &&
              configRevision === (this.configRevision || 0)) {
            wx.removeStorageSync('workInspirationConfigPending');
          }
        },
        complete: finish
      });
    }, finish);
  },

  toggleCompactMode() {
    const compactModePreference = this.data.isCompactMode ? 'full' : 'compact';
    wx.setStorageSync('workInspirationCompactMode', compactModePreference);
    this.setData({
      compactModePreference,
      isCompactMode: compactModePreference === 'compact',
      isEditingConfig: compactModePreference === 'compact' ? false : this.data.isEditingConfig
    });
  },

  startTimers() {
    this.clearTimers();
    this.updateClock();
    this.updateIncome();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.incomeTimer = setInterval(() => this.updateIncomeStatus(this.getWorkState()), 2000);
    this.incomeMotionTimer = setInterval(() => this.updateIncomeAmount(), 50);
    this.incomeMotionSpeedTimer = setTimeout(() => {
      clearInterval(this.incomeMotionTimer);
      this.incomeMotionTimer = setInterval(() => this.updateIncomeAmount(), 100);
    }, 6000);
    this.bonusTimer = setInterval(() => this.triggerTwoSecondBonus(), 1000);
    this.bonusSpeedTimer = setTimeout(() => {
      clearInterval(this.bonusTimer);
      this.bonusTimer = setInterval(() => this.triggerTwoSecondBonus(), 2000);
    }, 6000);
  },

  clearTimers() {
    clearInterval(this.clockTimer);
    clearInterval(this.incomeTimer);
    clearInterval(this.incomeMotionTimer);
    clearTimeout(this.incomeMotionSpeedTimer);
    clearInterval(this.bonusTimer);
    clearTimeout(this.bonusSpeedTimer);
    clearTimeout(this.bonusPulseTimer);
    this.clockTimer = null;
    this.incomeTimer = null;
    this.incomeMotionTimer = null;
    this.incomeMotionSpeedTimer = null;
    this.bonusTimer = null;
    this.bonusSpeedTimer = null;
    this.bonusPulseTimer = null;
  },

  updateClock() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const dateKey = this.getDateKey(now);
    this.setData({
      clock: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      currentDateText: `${pad(now.getMonth() + 1)} 月 ${pad(now.getDate())} 日 星期${weekdays[now.getDay()]}`
    });

    if (dateKey !== this.data.holidayDateKey) {
      this.fetchHolidayInfo(dateKey);
    }
  },

  timeToSeconds(value) {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 3600 + minutes * 60;
  },

  getDailyIncome() {
    const workDays = this.normalizeWorkDays(this.data.workDaysPerMonth);
    return Number(this.data.monthlySalary || 0) / workDays;
  },

  getDateKey(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  fetchHolidayInfo(dateKey) {
    this.setData({
      holidayDateKey: dateKey,
      holidayApiLoaded: false,
      apiDayOff: false,
      apiDayOffType: ''
    });

    wx.request({
      url: `${HOLIDAY_API_URL}${dateKey}`,
      method: 'GET',
      success: (response) => {
        // 接口类型：0 工作日、1 周末、2 节日、3 调休补班。
        const result = response.data || {};
        const type = result.type || {};
        const holiday = result.holiday || {};
        const typeValue = Number(type.type);
        const isDayOff = holiday.holiday === true || typeValue === 1 || typeValue === 2;

        // 日期跨天时丢弃上一天的异步响应。
        if (dateKey !== this.getDateKey(new Date())) {
          return;
        }

        this.setData({
          holidayApiLoaded: true,
          apiDayOff: isDayOff,
          apiDayOffType: holiday.name || type.name || (isDayOff ? '休息日' : '')
        }, () => {
          this.refreshIncomeRate();
          this.updateIncome();
        });
      },
      fail: () => {
        // 网络不可用时，仍保证普通周末有放假提示。
        this.setData({ holidayApiLoaded: true });
        this.updateIncome();
      }
    });
  },

  getDayOffInfo(now = new Date()) {
    const dateKey = this.getDateKey(now);

    if (this.data.holidayApiLoaded && this.data.holidayDateKey === dateKey) {
      return {
        isDayOff: this.data.apiDayOff,
        dayOffType: this.data.apiDayOffType
      };
    }

    // 接口结果返回前，以周末做临时兜底；接口返回后会覆盖该状态。
    if (now.getDay() === 0 || now.getDay() === 6) {
      return { isDayOff: true, dayOffType: '周末' };
    }

    return { isDayOff: false, dayOffType: '' };
  },

  getWorkState(now = new Date()) {
    const dayOffInfo = this.getDayOffInfo(now);

    if (dayOffInfo.isDayOff) {
      return {
        elapsedWorkSeconds: 0,
        totalWorkSeconds: 1,
        isWorking: false,
        workStatus: '今日放假',
        ...dayOffInfo
      };
    }

    const secondOfDay = now.getHours() * 3600 + now.getMinutes() * 60 +
      now.getSeconds() + now.getMilliseconds() / 1000;
    const morningStart = this.timeToSeconds(this.data.morningStart);
    const morningEnd = this.timeToSeconds(this.data.morningEnd);
    const afternoonStart = this.timeToSeconds(this.data.afternoonStart);
    const afternoonEnd = this.timeToSeconds(this.data.afternoonEnd);
    const morningSeconds = morningEnd - morningStart;
    const totalWorkSeconds = morningSeconds + afternoonEnd - afternoonStart;

    let elapsedWorkSeconds = 0;
    let isWorking = false;
    let workStatus = '未到上班时间';

    if (secondOfDay < morningStart) {
      workStatus = '未到上班时间';
    } else if (secondOfDay < morningEnd) {
      elapsedWorkSeconds = secondOfDay - morningStart;
      isWorking = true;
      workStatus = 'LIVE';
    } else if (secondOfDay < afternoonStart) {
      elapsedWorkSeconds = morningSeconds;
      workStatus = '午休中';
    } else if (secondOfDay < afternoonEnd) {
      elapsedWorkSeconds = morningSeconds + secondOfDay - afternoonStart;
      isWorking = true;
      workStatus = 'LIVE';
    } else {
      elapsedWorkSeconds = totalWorkSeconds;
      workStatus = '今日已完成';
    }

    return {
      elapsedWorkSeconds: Math.max(0, Math.min(totalWorkSeconds, elapsedWorkSeconds)),
      totalWorkSeconds,
      isWorking,
      workStatus,
      isDayOff: false,
      dayOffType: ''
    };
  },

  updateIncome() {
    const now = new Date();
    const state = this.getWorkState(now);
    this.incomeDate = now.toDateString();
    this.incomeWorkSeconds = state.elapsedWorkSeconds;
    this.incomePerSecond = this.getDailyIncome() / state.totalWorkSeconds;
    this.accumulatedIncome = this.incomePerSecond * state.elapsedWorkSeconds;
    this.renderIncome();
    this.updateIncomeStatus(state);
  },

  updateIncomeStatus(state) {
    const progress = state.elapsedWorkSeconds / state.totalWorkSeconds * 100;
    const remainingMinutes = Math.ceil((state.totalWorkSeconds - state.elapsedWorkSeconds) / 60);
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    this.setData({
      progressPercent: Math.min(100, progress).toFixed(2),
      progressWidth: `${Math.min(100, progress)}%`,
      remainingWorkTime: state.isDayOff ? '' : `${hours ? `${hours}小时` : ''}${minutes}分钟`,
      isWorking: state.isWorking,
      isDayOff: state.isDayOff,
      dayOffType: state.dayOffType,
      workStatus: state.workStatus
    });
  },

  updateIncomeAmount() {
    const now = new Date();
    const state = this.getWorkState(now);
    const workedSeconds = state.elapsedWorkSeconds - this.incomeWorkSeconds;
    if (now.toDateString() !== this.incomeDate || workedSeconds < 0) {
      this.updateIncome();
      return;
    }
    if (workedSeconds === 0) return;

    this.incomeWorkSeconds = state.elapsedWorkSeconds;
    this.accumulatedIncome = Math.min(this.getDailyIncome(),
      this.accumulatedIncome + workedSeconds * this.incomePerSecond);
    this.renderIncome();
  },

  renderIncome() {
    const todayIncome = this.accumulatedIncome.toFixed(3);
    if (todayIncome !== this.data.todayIncome) {
      this.setData({ todayIncome });
    }
  },

  refreshIncomeRate() {
    const state = this.getWorkState();
    const twoSecondAmount = this.getDailyIncome() / state.totalWorkSeconds * 2;
    this.setData({
      twoSecondAmount: twoSecondAmount.toFixed(4)
    });
  },

  beginConfigUpdate() {
    this.setData({
      draftMonthlySalary: this.data.monthlySalary,
      draftWorkDaysPerMonth: this.data.workDaysPerMonth,
      draftMorningStart: this.data.morningStart,
      draftMorningEnd: this.data.morningEnd,
      draftAfternoonStart: this.data.afternoonStart,
      draftAfternoonEnd: this.data.afternoonEnd,
      isEditingConfig: true,
      configStatus: '更新中'
    });
  },

  cancelConfigUpdate() {
    this.setData({
      isEditingConfig: false,
      configStatus: '已确认'
    });
  },

  onMonthlySalaryInput(event) {
    this.setData({
      draftMonthlySalary: event.detail.value
    });
  },

  onWorkDaysInput(event) {
    this.setData({
      draftWorkDaysPerMonth: event.detail.value
    });
  },

  toggleSalaryVisibility() {
    this.saveVisibility(!this.data.salaryHidden, this.data.incomeHidden);
  },

  toggleIncomeVisibility() {
    this.saveVisibility(this.data.salaryHidden, !this.data.incomeHidden);
  },

  saveVisibility(salaryHidden, incomeHidden) {
    const { monthlySalary, workDaysPerMonth, morningStart, morningEnd, afternoonStart, afternoonEnd } = this.data;
    this.saveRemoteConfig({
      monthlySalary, workDaysPerMonth, morningStart, morningEnd,
      afternoonStart, afternoonEnd, salaryHidden, incomeHidden
    }, true);
  },

  onConfigTimeChange(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [field]: event.detail.value
    });
  },

  confirmConfigUpdate() {
    const monthlySalary = Number(this.data.draftMonthlySalary);
    const workDaysPerMonth = Number(this.data.draftWorkDaysPerMonth);
    const morningStart = this.timeToSeconds(this.data.draftMorningStart);
    const morningEnd = this.timeToSeconds(this.data.draftMorningEnd);
    const afternoonStart = this.timeToSeconds(this.data.draftAfternoonStart);
    const afternoonEnd = this.timeToSeconds(this.data.draftAfternoonEnd);

    if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
      wx.showToast({ title: '请输入正确的月薪', icon: 'none' });
      return;
    }

    if (!Number.isInteger(workDaysPerMonth) || workDaysPerMonth < 1 || workDaysPerMonth > 31) {
      wx.showToast({ title: '请输入 1～31 天', icon: 'none' });
      return;
    }

    if (!(morningStart < morningEnd && morningEnd <= afternoonStart && afternoonStart < afternoonEnd)) {
      wx.showToast({ title: '请检查上班时间', icon: 'none' });
      return;
    }

    const config = {
      monthlySalary: monthlySalary.toFixed(2).replace(/\.00$/, ''),
      workDaysPerMonth,
      morningStart: this.data.draftMorningStart,
      morningEnd: this.data.draftMorningEnd,
      afternoonStart: this.data.draftAfternoonStart,
      afternoonEnd: this.data.draftAfternoonEnd,
      salaryHidden: this.data.salaryHidden,
      incomeHidden: this.data.incomeHidden
    };

    this.saveRemoteConfig(config);
  },

  triggerTwoSecondBonus() {
    const state = this.getWorkState();
    if (!state.isWorking) {
      this.setData({
        bonusPulse: false,
        isWorking: false,
        workStatus: state.workStatus
      });
      return;
    }

    this.setData({ bonusPulse: false }, () => {
      this.setData({ bonusPulse: true });
      clearTimeout(this.bonusPulseTimer);
      this.bonusPulseTimer = setTimeout(() => {
        this.setData({ bonusPulse: false });
      }, 1000);
    });
  },

  onBannerAdLoad() {
    console.log('Banner 广告加载成功');
  },

  onBannerAdError(event) {
    console.warn('Banner 广告加载失败', event.detail);
  },

  onBannerAdClose() {
    console.log('Banner 广告已关闭');
  },

  // 当前页面转发
  onShareAppMessage() {
    return {
      title: '上班鼓励宝',
      path: '/pages/workInspiration/workInspiration'
    };
  },
  onShareTimeline() {
    return {
      title: '上班鼓励宝',
      query: ''
    };
  }
});
