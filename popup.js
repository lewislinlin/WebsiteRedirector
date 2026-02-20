// 弹出界面脚本
let currentSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 获取设置
  currentSettings = await getSettings();
  renderSettings(currentSettings);
  setupEventListeners();
  updatePauseDisplay();
});

// 获取设置
async function getSettings() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  return response;
}

// 更新设置
async function updateSettings(settings) {
  await chrome.runtime.sendMessage({ 
    action: 'updateSettings', 
    settings: settings 
  });
  currentSettings = { ...currentSettings, ...settings };
}

// 渲染设置
function renderSettings(settings) {
  // 启用开关
  document.getElementById('enable-toggle').checked = settings.isEnabled;
  
  // 目标网站
  document.getElementById('target-url').value = settings.targetUrl || '';
  
  // 跳转模式
  document.getElementById('redirect-mode').value = settings.redirectMode || 'instant';
  
  // 源网站列表
  renderSiteList(settings.sourceSites || []);
  
  // 更新状态
  updateStatus(settings);
}

// 渲染网站列表
function renderSiteList(sites) {
  const listContainer = document.getElementById('site-list');
  
  if (sites.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">暂无源网站</div>';
    return;
  }
  
  listContainer.innerHTML = sites.map((site, index) => `
    <div class="site-item">
      <span>${site}</span>
      <button class="site-remove" data-index="${index}">移除</button>
    </div>
  `).join('');
  
  // 绑定移除事件
  listContainer.querySelectorAll('.site-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeSite(index);
    });
  });
}

// 更新状态显示
function updateStatus(settings) {
  const statusText = document.getElementById('status-text');
  const pauseSection = document.getElementById('pause-section');
  
  if (!settings.isEnabled) {
    statusText.textContent = '状态: 未启用';
    statusText.className = 'status-text status-inactive';
    pauseSection.style.display = 'none';
  } else if (settings.isPaused && Date.now() < settings.pauseEndTime) {
    const remaining = Math.ceil((settings.pauseEndTime - Date.now()) / 1000 / 60);
    statusText.textContent = `状态: 已暂停（剩余 ${remaining} 分钟）`;
    statusText.className = 'status-text status-paused';
    pauseSection.style.display = 'block';
  } else {
    statusText.textContent = '状态: 运行中';
    statusText.className = 'status-text status-active';
    pauseSection.style.display = 'block';
  }
}

// 更新暂停显示
function updatePauseDisplay() {
  if (!currentSettings) return;
  
  const resumeBtn = document.getElementById('resume-btn');
  
  if (currentSettings.isPaused && Date.now() < currentSettings.pauseEndTime) {
    resumeBtn.style.display = 'block';
  } else {
    resumeBtn.style.display = 'none';
  }
  
  updateStatus(currentSettings);
}

// 设置事件监听
function setupEventListeners() {
  // 启用开关
  document.getElementById('enable-toggle').addEventListener('change', async (e) => {
    await updateSettings({ isEnabled: e.target.checked });
    updateStatus(currentSettings);
  });
  
  // 目标网站
  document.getElementById('target-url').addEventListener('input', async (e) => {
    await updateSettings({ targetUrl: e.target.value });
  });
  
  // 跳转模式
  document.getElementById('redirect-mode').addEventListener('change', async (e) => {
    await updateSettings({ redirectMode: e.target.value });
  });
  
  // 添加网站
  document.getElementById('add-site-btn').addEventListener('click', addSite);
  document.getElementById('new-site').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });
  
  // 暂停按钮
  document.querySelectorAll('.pause-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const duration = parseInt(e.target.dataset.duration);
      await pause(duration);
    });
  });
  
  // 恢复按钮
  document.getElementById('resume-btn').addEventListener('click', resume);
  
  // 推荐目标网站按钮
  document.querySelectorAll('[data-preset-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.dataset.presetTarget;
      document.getElementById('target-url').value = url;
      updateSettings({ targetUrl: url });
      showToast(`已设置目标网站: ${url}`);
    });
  });
  
  // 推荐源网站套餐按钮
  document.querySelectorAll('[data-preset-sites]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sitesStr = e.target.dataset.presetSites;
      const sites = sitesStr.split(',');
      addMultipleSites(sites);
    });
  });
}

// 添加网站
async function addSite() {
  const input = document.getElementById('new-site');
  let site = input.value.trim();
  
  if (!site) return;
  
  // 清理 URL
  try {
    if (site.startsWith('http')) {
      const urlObj = new URL(site);
      site = urlObj.hostname.replace('www.', '');
    } else {
      site = site.replace('www.', '');
    }
  } catch (e) {
    // 如果不是 URL，直接使用
  }
  
  // 检查是否已存在
  if (currentSettings.sourceSites.includes(site)) {
    showToast('该网站已在列表中');
    return;
  }
  
  const newSites = [...currentSettings.sourceSites, site];
  await updateSettings({ sourceSites: newSites });
  renderSiteList(newSites);
  input.value = '';
  showToast(`已添加: ${site}`);
}

// 添加多个网站
async function addMultipleSites(sites) {
  let addedCount = 0;
  const newSites = [...currentSettings.sourceSites];
  
  for (const site of sites) {
    if (!newSites.includes(site)) {
      newSites.push(site);
      addedCount++;
    }
  }
  
  if (addedCount > 0) {
    await updateSettings({ sourceSites: newSites });
    renderSiteList(newSites);
    showToast(`已添加 ${addedCount} 个网站`);
  } else {
    showToast('这些网站已经在列表中了');
  }
}

// 移除网站
async function removeSite(index) {
  const newSites = currentSettings.sourceSites.filter((_, i) => i !== index);
  await updateSettings({ sourceSites: newSites });
  renderSiteList(newSites);
  showToast('已移除');
}

// 暂停
async function pause(duration) {
  const response = await chrome.runtime.sendMessage({ 
    action: 'pause', 
    duration: duration 
  });
  
  if (response.success) {
    currentSettings.isPaused = true;
    currentSettings.pauseEndTime = response.endTime;
    updatePauseDisplay();
    const minutes = duration / 60000;
    showToast(`已暂停 ${minutes} 分钟`);
  }
}

// 恢复
async function resume() {
  const response = await chrome.runtime.sendMessage({ action: 'resume' });
  
  if (response.success) {
    currentSettings.isPaused = false;
    currentSettings.pauseEndTime = 0;
    updatePauseDisplay();
    showToast('已恢复');
  }
}

// 显示提示
function showToast(message) {
  // 创建一个简单的 toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);

// 定期更新暂停时间显示
setInterval(() => {
  if (currentSettings?.isPaused) {
    updatePauseDisplay();
  }
}, 1000);
