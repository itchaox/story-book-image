// Chrome扩展程序popup交互逻辑
document.addEventListener('DOMContentLoaded', function() {
  // 获取导出按钮元素
  const exportBtn = document.querySelector('.export-btn');
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'margin-top: 10px; padding: 8px; font-size: 12px; border-radius: 4px;';
  exportBtn.parentNode.appendChild(statusDiv);
  
  // 添加调试标志
  const DEBUG = true;
  
  // 调试日志函数
  function debugLog(message, data = null) {
    if (DEBUG) {
      console.log(`[Popup] ${message}`, data || '');
    }
  }
  
  // 错误日志函数
  function errorLog(message, error = null) {
    console.error(`[Popup Error] ${message}`, error || '');
  }
  
  // 更新状态显示
  function updateStatus(message, isError = false) {
    debugLog('状态更新', { message, isError });
    statusDiv.textContent = message;
    statusDiv.style.backgroundColor = isError ? '#ffebee' : '#e8f5e8';
    statusDiv.style.color = isError ? '#c62828' : '#2e7d32';
    statusDiv.style.border = isError ? '1px solid #ffcdd2' : '1px solid #c8e6c9';
  }
  
  // 手动注入content script
  async function injectContentScript(tabId) {
    try {
      debugLog('开始手动注入content script...');
      
      // 注入库文件
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['libs/jszip.min.js']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['libs/html2canvas.min.js']
      });
      
      // 注入主脚本
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      debugLog('手动注入完成');
      return true;
    } catch (error) {
      errorLog('手动注入失败', error);
      return false;
    }
  }

  // 检测content script是否已注入
  async function checkContentScriptInjection(tabId, retries = 3) {
    debugLog('检测content script注入状态', { tabId, retries });
    
    for (let i = 0; i < retries; i++) {
      try {
        debugLog(`尝试ping content script - 第${i + 1}次`);
        
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'ping'
        });
        
        if (response && response.success) {
          debugLog('Content script响应正常', response);
          return true;
        }
      } catch (error) {
        debugLog(`Ping失败 - 第${i + 1}次`, error.message);
        
        if (i < retries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // 最后一次尝试失败，尝试手动注入
          errorLog('Ping检测失败，尝试手动注入', error);
          
          const injected = await injectContentScript(tabId);
          if (injected) {
            // 等待一下再次检查
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
              if (response && response.success) {
                debugLog('手动注入后检测成功');
                return true;
              }
            } catch (retryError) {
              errorLog('手动注入后仍然失败', retryError);
            }
          }
        }
      }
    }
    
    return false;
  }
  
  // 等待页面加载完成
  async function waitForPageLoad(tabId, maxWait = 10000) {
    debugLog('等待页面加载完成', { tabId, maxWait });
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const tab = await chrome.tabs.get(tabId);
        debugLog('页面状态', { status: tab.status, url: tab.url });
        
        if (tab.status === 'complete') {
          debugLog('页面加载完成');
          return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorLog('获取页面状态失败', error);
        break;
      }
    }
    
    return false;
  }
  
  // 监听导出按钮点击事件
  exportBtn.addEventListener('click', async function() {
    try {
      debugLog('开始导出流程');
      
      // 禁用按钮防止重复点击
      exportBtn.disabled = true;
      exportBtn.textContent = '导出中...';
      updateStatus('正在获取当前页面...');
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      debugLog('当前标签页信息', { id: tab.id, url: tab.url, status: tab.status });
      
      // 等待页面加载完成
      updateStatus('等待页面加载完成...');
      const pageLoaded = await waitForPageLoad(tab.id);
      
      if (!pageLoaded) {
        throw new Error('页面加载超时，请刷新页面后重试');
      }
      
      // 检测content script是否已注入
      updateStatus('检测扩展程序状态...');
      const scriptInjected = await checkContentScriptInjection(tab.id);
      
      if (!scriptInjected) {
        throw new Error('扩展程序未正确加载，请刷新页面后重试');
      }
      
      updateStatus('正在处理页面元素...');
      
      // 向content script发送导出消息
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'exportImages'
      });
      
      debugLog('收到content script响应', response);
      
      if (response && response.success) {
        const count = response.data?.count || 0;
        updateStatus(`导出完成！已处理 ${count} 个元素并打包下载。`);
      } else {
        throw new Error(response?.error || '导出失败');
      }
      
    } catch (error) {
      errorLog('导出过程中出错', error);
      
      // 根据错误类型提供不同的提示
      if (error.message.includes('Could not establish connection') || 
          error.message.includes('Receiving end does not exist')) {
        updateStatus('扩展程序通信失败，请刷新页面后重试。', true);
      } else if (error.message.includes('页面加载超时')) {
        updateStatus('页面加载超时，请等待页面完全加载后重试。', true);
      } else if (error.message.includes('扩展程序未正确加载')) {
        updateStatus('扩展程序未正确加载，请刷新页面并重新加载扩展程序。', true);
      } else {
        updateStatus(`导出失败: ${error.message}`, true);
      }
    } finally {
      // 恢复按钮状态
      exportBtn.disabled = false;
      exportBtn.textContent = '导出图片';
      debugLog('导出流程结束');
    }
  });
  
  debugLog('Chrome扩展程序popup已加载');
  updateStatus('准备就绪，点击按钮开始导出');
});