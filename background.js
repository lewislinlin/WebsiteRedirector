// 后台服务脚本
console.log('网站跳转器后台服务已启动');

// 存储结构
const defaultSettings = {
  isEnabled: true,
  targetUrl: 'https://www.baidu.com',
  sourceSites: [],
  whitelist: [],
  pauseEndTime: 0,
  isPaused: false,
  dailyLimit: 0, // 0 表示无限制，单位分钟
  todayUsage: {}, // {date: '2024-01-01', usage: {site1: 10, site2: 20}}
  redirectMode: 'instant', // 'instant' 立即跳转, 'timer' 计时模式, 'countdown' 倒计时模式
  userPurpose: '' // 用户设置的目的，用于提醒
};

// 初始化存储
async function initStorage() {
  const data = await chrome.storage.local.get(Object.keys(defaultSettings));
  const newData = { ...defaultSettings, ...data };
  await chrome.storage.local.set(newData);
  return newData;
}

// 获取当前日期
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// 检查是否是源网站
function isSourceSite(url, sourceSites) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return sourceSites.some(site => {
      // 清理用户输入的网站
      let siteHostname = site.trim();
      
      // 如果用户输入的是完整 URL，提取 hostname
      if (siteHostname.startsWith('http://') || siteHostname.startsWith('https://')) {
        try {
          siteHostname = new URL(siteHostname).hostname;
        } catch (e) {
          // 如果解析失败，继续使用原始输入
        }
      }
      
      // 移除 www. 前缀进行比较
      const cleanHostname = hostname.replace(/^www\./, '');
      const cleanSiteHostname = siteHostname.replace(/^www\./, '');
      
      // 精确匹配或子域名匹配
      // 例如：hostname = "www.douyin.com", site = "douyin.com" → 匹配
      // 例如：hostname = "m.douyin.com", site = "douyin.com" → 匹配
      // 例如：hostname = "douyin.com", site = "www.douyin.com" → 匹配
      // 例如：hostname = "other.com", site = "douyin.com" → 不匹配
      return cleanHostname === cleanSiteHostname || 
             cleanHostname.endsWith('.' + cleanSiteHostname);
    });
  } catch (e) {
    return false;
  }
}

// 检查暂停是否结束，并刷新相关页面
async function checkPauseAndRefresh() {
  const settings = await initStorage();
  
  if (settings.isPaused && Date.now() >= settings.pauseEndTime) {
    // 暂停结束了！
    console.log('暂停结束，恢复监控');
    await chrome.storage.local.set({ isPaused: false, pauseEndTime: 0 });
    
    // 刷新所有源网站的标签页
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && isSourceSite(tab.url, settings.sourceSites)) {
        console.log('刷新标签页:', tab.url);
        chrome.tabs.reload(tab.id);
      }
    }
  }
}

// 定期检查（每秒）
setInterval(checkPauseAndRefresh, 1000);

// 标签页更新监听
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  
  const settings = await initStorage();
  
  // 检查是否暂停
  if (settings.isPaused) {
    if (Date.now() > settings.pauseEndTime) {
      await chrome.storage.local.set({ isPaused: false, pauseEndTime: 0 });
    } else {
      return;
    }
  }
  
  if (!settings.isEnabled) return;
  
  // 检查是否是源网站
  if (isSourceSite(tab.url, settings.sourceSites)) {
    // 记录使用时间
    await trackUsage(tab.url);
    
    // 执行跳转
    if (settings.redirectMode === 'instant') {
      await chrome.tabs.update(tabId, { url: settings.targetUrl });
    }
  }
});

// 记录使用时间
async function trackUsage(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const today = getTodayString();
    
    const data = await chrome.storage.local.get(['todayUsage']);
    let todayUsage = data.todayUsage || {};
    
    if (todayUsage.date !== today) {
      todayUsage = { date: today, usage: {} };
    }
    
    if (!todayUsage.usage[hostname]) {
      todayUsage.usage[hostname] = 0;
    }
    todayUsage.usage[hostname] += 1; // 每次访问增加 1 个计数
    
    await chrome.storage.local.set({ todayUsage });
  } catch (e) {
    console.error('记录使用时间失败:', e);
  }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSettings':
      initStorage().then(sendResponse);
      return true;
      
    case 'updateSettings':
      chrome.storage.local.set(request.settings).then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'pause':
      const pauseEndTime = Date.now() + request.duration;
      chrome.storage.local.set({ 
        isPaused: true, 
        pauseEndTime: pauseEndTime 
      }).then(() => {
        sendResponse({ success: true, endTime: pauseEndTime });
      });
      return true;
      
    case 'resume':
      chrome.storage.local.set({ 
        isPaused: false, 
        pauseEndTime: 0 
      }).then(async () => {
        // 立即刷新所有源网站标签页
        const settings = await initStorage();
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.url && isSourceSite(tab.url, settings.sourceSites)) {
            chrome.tabs.reload(tab.id);
          }
        }
        sendResponse({ success: true });
      });
      return true;
  }
});

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  initStorage();
  console.log('网站跳转器已安装');
});

// 启动时初始化
initStorage();
