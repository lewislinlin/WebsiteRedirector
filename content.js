// 内容脚本 - 在网页中运行
console.log('网站跳转器内容脚本已加载');

let countdownInterval = null;
let overlayDiv = null;
let reminderDiv = null;
let userPurpose = '';
let isCountdownShowing = false; // 防止重复显示倒计时
let lastReminderTime = 0; // 上次提醒时间
const REMINDER_INTERVAL = 3 * 60 * 1000; // 每 3 分钟提醒一次

// 检查并显示倒计时
async function checkAndShowCountdown() {
  const settings = await chrome.storage.local.get([
    'isEnabled', 
    'isPaused', 
    'pauseEndTime', 
    'redirectMode',
    'sourceSites',
    'targetUrl',
    'userPurpose'
  ]);
  
  userPurpose = settings.userPurpose || '';
  
  if (!settings.isEnabled) {
    removeReminder();
    return;
  }
  
  // 检查是否暂停
  if (settings.isPaused && Date.now() < settings.pauseEndTime) {
    removeReminder();
    return;
  }
  
  // 检查是否是源网站
  if (!isSourceSite(window.location.href, settings.sourceSites)) {
    removeReminder();
    return;
  }
  
  // 显示提醒（每次都显示）
  showReminder();
  
  // 检查是否需要定期重新显示提醒
  const now = Date.now();
  if (now - lastReminderTime > REMINDER_INTERVAL) {
    lastReminderTime = now;
    // 重新显示倒计时提醒（如果模式是倒计时）
    if (settings.redirectMode === 'countdown' && !isCountdownShowing) {
      showCountdown(settings.targetUrl, true);
    }
  }
  
  // 根据模式处理（只有倒计时模式才显示倒计时弹窗，且只显示一次）
  if (settings.redirectMode === 'countdown' && !isCountdownShowing) {
    showCountdown(settings.targetUrl, false);
  }
}

// 检查是否是源网站
function isSourceSite(url, sourceSites) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    return sourceSites.some(site => {
      const siteHostname = site.replace('www.', '');
      return hostname.includes(siteHostname) || siteHostname.includes(hostname);
    });
  } catch (e) {
    return false;
  }
}

// 显示提醒浮窗
function showReminder() {
  if (reminderDiv) {
    // 更新提醒内容
    const reminderText = reminderDiv.querySelector('#reminder-text');
    if (reminderText && userPurpose) {
      reminderText.textContent = userPurpose;
    }
    // 更新提醒样式，引起注意
    reminderDiv.style.animation = 'pulse 2s infinite';
    return;
  }
  
  // 添加动画样式
  if (!document.getElementById('website-redirector-styles')) {
    const style = document.createElement('style');
    style.id = 'website-redirector-styles';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4); }
        50% { transform: scale(1.05); box-shadow: 0 10px 60px rgba(102, 126, 234, 0.6); }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // 创建提醒浮窗
  reminderDiv = document.createElement('div');
  reminderDiv.id = 'website-redirector-reminder';
  reminderDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(239, 68, 68, 0.4);
    z-index: 999999;
    max-width: 320px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: move;
    user-select: none;
    animation: pulse 2s infinite;
  `;
  
  reminderDiv.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="font-size: 24px;">⚠️</div>
      <div style="flex: 1;">
        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px; font-weight: 600;">记得你的目的！</div>
        <div id="reminder-text" style="font-size: 16px; font-weight: 700; line-height: 1.4;">
          ${userPurpose || '记得你的目的！'}
        </div>
      </div>
      <button id="close-reminder" style="
        background: none;
        border: none;
        color: white;
        opacity: 0.8;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
  `;
  
  document.body.appendChild(reminderDiv);
  
  // 关闭按钮
  const closeBtn = reminderDiv.querySelector('#close-reminder');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 点击关闭时抖动提醒，不真正关闭
    reminderDiv.style.animation = 'shake 0.5s';
    setTimeout(() => {
      reminderDiv.style.animation = 'pulse 2s infinite';
    }, 500);
  });
  
  // 拖拽功能
  let isDragging = false;
  let offsetX, offsetY;
  
  reminderDiv.addEventListener('mousedown', (e) => {
    if (e.target.id === 'close-reminder') return;
    isDragging = true;
    offsetX = e.clientX - reminderDiv.getBoundingClientRect().left;
    offsetY = e.clientY - reminderDiv.getBoundingClientRect().top;
    reminderDiv.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    reminderDiv.style.left = x + 'px';
    reminderDiv.style.top = y + 'px';
    reminderDiv.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    reminderDiv.style.cursor = 'move';
  });
}

// 移除提醒浮窗
function removeReminder() {
  if (reminderDiv) {
    reminderDiv.remove();
    reminderDiv = null;
  }
}

// 显示倒计时
function showCountdown(targetUrl, isPeriodicReminder = false) {
  // 如果已有倒计时，先移除
  if (overlayDiv) {
    return;
  }
  
  // 标记倒计时正在显示
  isCountdownShowing = true;
  
  // 创建倒计时遮罩
  overlayDiv = document.createElement('div');
  overlayDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 999998;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  let countdown = isPeriodicReminder ? 10 : 15; // 定期提醒只给 10 秒
  
  overlayDiv.innerHTML = `
    <div style="text-align: center; max-width: 500px; padding: 20px;">
      <div style="font-size: 64px; font-weight: bold; margin-bottom: 20px; color: #ef4444;">
        ⚠️
      </div>
      <div style="font-size: 24px; margin-bottom: 10px; color: #fca5a5;">
        ${isPeriodicReminder ? '你已经用了3分钟了！' : '你真的要继续吗？'}
      </div>
      <div style="font-size: 48px; font-weight: bold; margin-bottom: 20px;">
        <span id="countdown-number">${countdown}</span>
      </div>
      <div style="font-size: 20px; margin-bottom: 20px; opacity: 0.9;">
        ${isPeriodicReminder ? '记得你的目的，确定要继续吗？' : '即将跳转到目标网站...'}
      </div>
      <div style="margin-bottom: 30px;">
        <div style="font-size: 14px; margin-bottom: 20px; color: #fbbf24;">
          💡 你还记得你的目的是什么吗？
        </div>
        <input 
          type="text" 
          id="confirm-input"
          placeholder="输入你的目的（例如：我要学习）"
          value="${userPurpose}"
          style="
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #4b5563;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 16px;
            margin-bottom: 12px;
            outline: none;
          "
        />
        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 16px;">
          输入你的目的后才能取消跳转
        </div>
        <button id="cancel-btn" style="
          width: 100%;
          padding: 12px 32px;
          font-size: 16px;
          background: #374151;
          color: #9ca3af;
          border: none;
          border-radius: 8px;
          cursor: not-allowed;
          opacity: 0.5;
        " disabled>
          ${isPeriodicReminder ? '我确定要继续（需输入目的）' : '取消跳转（需输入目的）'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlayDiv);
  
  // 倒计时
  countdownInterval = setInterval(() => {
    countdown--;
    const countdownEl = document.getElementById('countdown-number');
    if (countdownEl) {
      countdownEl.textContent = countdown;
    }
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      window.location.href = targetUrl;
    }
  }, 1000);
  
  // 输入框 - 确保可以正常输入
  const confirmInput = document.getElementById('confirm-input');
  const cancelBtn = document.getElementById('cancel-btn');
  
  // 让输入框自动获取焦点
  setTimeout(() => {
    confirmInput.focus();
    confirmInput.select();
  }, 100);
  
  // 输入框变化检查
  confirmInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    userPurpose = value;
    // 保存到 storage
    chrome.storage.local.set({ userPurpose: value });
    
    if (value.length >= 3) {
      cancelBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      cancelBtn.style.color = 'white';
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.style.opacity = '1';
      cancelBtn.disabled = false;
      cancelBtn.textContent = isPeriodicReminder ? '我确定要继续' : '确认，我仍然要继续';
    } else {
      cancelBtn.style.background = '#374151';
      cancelBtn.style.color = '#9ca3af';
      cancelBtn.style.cursor = 'not-allowed';
      cancelBtn.style.opacity = '0.5';
      cancelBtn.disabled = true;
      cancelBtn.textContent = isPeriodicReminder ? '我确定要继续（需输入目的）' : '取消跳转（需输入目的）';
    }
  });
  
  // 取消按钮
  cancelBtn.addEventListener('click', () => {
    const confirmValue = confirmInput.value.trim();
    if (confirmValue.length < 3) {
      return;
    }
    
    clearInterval(countdownInterval);
    if (overlayDiv) {
      overlayDiv.remove();
      overlayDiv = null;
      isCountdownShowing = false;
    }
    
    // 显示提醒浮窗
    showReminder();
  });
}

// 页面加载时检查
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndShowCountdown);
} else {
  checkAndShowCountdown();
}

// URL 变化时检查（SPA 应用）
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    isCountdownShowing = false; // URL 变化时重置标记
    lastReminderTime = 0; // 重置提醒时间
    checkAndShowCountdown();
  }
}).observe(document, { subtree: true, childList: true });

// 定期检查（确保提醒一直显示）
setInterval(checkAndShowCountdown, 1000);
