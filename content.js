// Chrome扩展程序内容脚本 - 处理页面中spread-container元素的批量导出

// 添加调试标志
const DEBUG = true;

// 调试日志函数
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[Content Script] ${message}`, data || '');
    }
}

// 错误日志函数
function errorLog(message, error = null) {
    console.error(`[Content Script Error] ${message}`, error || '');
}

// 等待html2canvas库加载完成
function waitForHtml2Canvas() {
    return new Promise((resolve, reject) => {
        debugLog('开始等待html2canvas库加载...');
        
        if (typeof html2canvas !== 'undefined') {
            debugLog('html2canvas库已可用');
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒
        
        const checkInterval = setInterval(() => {
            attempts++;
            debugLog(`检查html2canvas库 - 尝试 ${attempts}/${maxAttempts}`);
            
            if (typeof html2canvas !== 'undefined') {
                clearInterval(checkInterval);
                debugLog('html2canvas库加载成功');
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                const error = 'html2canvas库加载超时';
                errorLog(error);
                reject(new Error(error));
            }
        }, 100);
    });
}

// 创建ZIP文件并下载
function createAndDownloadZip(images) {
    debugLog('开始创建ZIP文件', `包含 ${images.length} 张图片`);
    
    // 检查JSZip是否可用
    if (typeof JSZip === 'undefined') {
        const error = 'JSZip库未加载';
        errorLog(error);
        throw new Error(error);
    }

    const zip = new JSZip();
    
    // 将所有图片添加到ZIP文件中
    images.forEach((imageData, index) => {
        const fileName = `p${index + 1}.png`;
        // 移除data:image/png;base64,前缀
        const base64Data = imageData.split(',')[1];
        zip.file(fileName, base64Data, {base64: true});
    });

    // 生成ZIP文件并下载
    return zip.generateAsync({type: 'blob'})
        .then(function(content) {
            debugLog('ZIP文件生成成功，开始下载');
            
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Story Book.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            debugLog('批量导出完成！');
            return true;
        })
        .catch(function(error) {
            errorLog('生成ZIP文件时出错', error);
            throw error;
        });
}

// 批量导出spread-container元素为图片
async function exportSpreadContainers() {
    try {
        debugLog('开始批量导出流程...');
        debugLog('当前页面URL', window.location.href);
        debugLog('页面加载状态', document.readyState);
        
        // 等待html2canvas库加载
        await waitForHtml2Canvas();
        
        // 查找所有spread-container元素
        const containers = document.querySelectorAll('.spread-container');
        debugLog(`找到 ${containers.length} 个spread-container元素`);
        
        if (containers.length === 0) {
            const error = '未找到任何spread-container元素，请确保页面包含相关内容';
            errorLog(error);
            throw new Error(error);
        }
        
        const images = [];
        
        // 逐个转换每个容器为图片
        for (let i = 0; i < containers.length; i++) {
            const container = containers[i];
            console.log(`正在处理第 ${i + 1} 个元素...`);
            
            try {
                // 使用html2canvas转换元素为canvas
                const canvas = await html2canvas(container, {
                    backgroundColor: '#ffffff',
                    scale: 2, // 提高图片质量
                    useCORS: true,
                    allowTaint: true,
                    logging: false
                });
                
                // 将canvas转换为base64图片数据
                const imageData = canvas.toDataURL('image/png');
                images.push(imageData);
                
                console.log(`第 ${i + 1} 个元素转换完成`);
            } catch (error) {
                console.error(`转换第 ${i + 1} 个元素时出错:`, error);
            }
        }
        
        if (images.length > 0) {
            debugLog(`成功转换 ${images.length} 个图片，开始打包下载...`);
            await createAndDownloadZip(images);
            return { success: true, count: images.length };
        } else {
            const error = '没有成功转换任何图片';
            errorLog(error);
            throw new Error(error);
        }
        
    } catch (error) {
        errorLog('批量导出过程中出错', error);
        throw error;
    }
}

// 防止重复注入
if (window.storyBookExporterInjected) {
    debugLog('Content script已经注入，跳过重复注入');
    // 即使已注入，也要确保消息监听器正常工作
    console.log('%c[Story Book Exporter] Content script already injected, listener active!', 'color: orange; font-weight: bold;');
} else {
    window.storyBookExporterInjected = true;
    debugLog('Content script首次注入');
    
    // 立即向控制台输出注入成功信息
    console.log('%c[Story Book Exporter] Content script successfully injected!', 'color: green; font-weight: bold;');
    
    // 输出详细的环境信息
    console.log('%c[Story Book Exporter] Environment Info:', 'color: blue; font-weight: bold;', {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    });
    
    // 检查必要的库是否加载
    const checkLibraries = () => {
        const html2canvasLoaded = typeof html2canvas !== 'undefined';
        const jszipLoaded = typeof JSZip !== 'undefined';
        
        debugLog('库加载状态检查', {
            html2canvas: html2canvasLoaded,
            JSZip: jszipLoaded,
            location: window.location.href
        });
        
        if (!html2canvasLoaded) {
            errorLog('html2canvas库未加载');
        }
        if (!jszipLoaded) {
            errorLog('JSZip库未加载');
        }
        
        return html2canvasLoaded && jszipLoaded;
    };
    
    // 延迟检查库加载状态
    setTimeout(checkLibraries, 100);
    
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('%c[Story Book Exporter] Message received:', 'color: purple; font-weight: bold;', request);
        debugLog('收到消息', request);
        
        try {
            if (request.action === 'ping') {
                debugLog('响应ping请求');
                
                // 检查库加载状态
                const html2canvasLoaded = typeof html2canvas !== 'undefined';
                const jszipLoaded = typeof JSZip !== 'undefined';
                
                const response = {
                    success: true,
                    message: 'Content script is ready',
                    libraries: {
                        html2canvas: html2canvasLoaded,
                        JSZip: jszipLoaded
                    },
                    url: window.location.href,
                    readyState: document.readyState
                };
                
                debugLog('Ping响应', response);
                sendResponse(response);
                return true;
            }
            
            if (request.action === 'exportImages') {
                debugLog('开始导出图片流程');
                
                // 检查必要条件
                if (typeof html2canvas === 'undefined') {
                    throw new Error('html2canvas库未加载，请刷新页面重试');
                }
                if (typeof JSZip === 'undefined') {
                    throw new Error('JSZip库未加载，请刷新页面重试');
                }
                
                // 异步处理导出
                (async () => {
                    try {
                        const result = await exportSpreadContainers();
                        debugLog('导出完成', result);
                        sendResponse({ success: true, data: result });
                    } catch (error) {
                        errorLog('导出失败', error);
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                
                return true; // 保持消息通道开放
            }
            
            debugLog('未知消息类型', request.action);
            sendResponse({ success: false, error: '未知消息类型' });
        } catch (error) {
            errorLog('消息处理异常', error);
            sendResponse({ success: false, error: `消息处理异常: ${error.message}` });
        }
        
        return true;
    });
    
    debugLog('Content script已加载完成，等待导出指令...');
    debugLog('页面信息', {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        html2canvas: typeof html2canvas !== 'undefined',
        JSZip: typeof JSZip !== 'undefined'
    });
}