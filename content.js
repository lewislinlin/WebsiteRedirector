// 内容脚本 - 在网页中运行
console.log('网站跳转器内容脚本已加载');

let countdownInterval = null;
let overlayDiv = null;

// 检查并显示倒计时
async function checkAndShowCountdown() {
  const settings = await chrome.storage.local.get([
    'isEnabled', 
    'isPaused', 
    'pauseEndTime', 
    'redirectMode',
    'sourceSites',
    'targetUrl'
  ]);
  
  if (!settings.isEnabled) return;
  
  // 检查是否暂停
  if (settings.isPaused && Date.now() < settings.pauseEndTime) {
    return;
  }
  
  // 检查是否是源网站
  if (!isSourceSite(window.location.href, settings.sourceSites)) {
    return;
  }
  
  // 根据模式处理
  if (settings.redirectMode === 'countdown') {
    showCountdown(settings.targetUrl);
  } else if (settings.redirectMode === 'timer') {
    // 计时模式 - 暂时不做什么，让用户使用一段时间
    console.log('计时模式，将在一段时间后跳转');
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

// 显示倒计时
function showCountdown(targetUrl) {
  // 如果已有倒计时，先移除
  if (overlayDiv) {
    overlayDiv.remove();
  }
  
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
    z-index: 999999;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  let countdown = 5;
  
  overlayDiv.innerHTML = `
    <div style="text-align: center; max-width: 500px; padding: 20px;">
      <div style="font-size: 48px; font-weight: bold; margin-bottom: 20px; color: #f59e0b;">
        ⏰
      </div>
      <div style="font-size: 32px; font-weight: bold; margin-bottom: 10px;">
        <span id="countdown-number">${countdown}</span>
      </div>
      <div style="font-size: 20px; margin-bottom: 20px; opacity: 0.9;">
        即将跳转到目标网站...
      </div>
      <div style="margin-bottom: 30px;">
        <div style="font-size: 14px; margin-bottom: 20px; color: #fbbf24;">
          💡 你还记得你的目的是什么吗？
        </div>
        <input 
          type="text" 
          id="confirm-input"
          placeholder="输入你的目的（例如：我要学习）"
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
          取消跳转（需输入目的）
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
  
  // 输入框变化检查
  const confirmInput = document.getElementById('confirm-input');
  const cancelBtn = document.getElementById('cancel-btn');
  
  confirmInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (value.length >= 3) {
      cancelBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      cancelBtn.style.color = 'white';
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.style.opacity = '1';
      cancelBtn.disabled = false;
      cancelBtn.textContent = '确认，我仍然要继续';
    } else {
      cancelBtn.style.background = '#374151';
      cancelBtn.style.color = '#9ca3af';
      cancelBtn.style.cursor = 'not-allowed';
      cancelBtn.style.opacity = '0.5';
      cancelBtn.disabled = true;
      cancelBtn.textContent = '取消跳转（需输入目的）';
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
    }
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
    checkAndShowCountdown();
  }
}).observe(document, { subtree: true, childList: true });
