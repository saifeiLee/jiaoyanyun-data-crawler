// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadData') {
    // 创建并下载JSON文件
    const blob = new Blob([JSON.stringify(message.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 使用传入的文件名，或生成时间戳文件名
    const filename = message.filename || 
      `知识树数据_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载错误:', chrome.runtime.lastError);
      } else {
        console.log('文件下载开始，ID:', downloadId);
      }
    });
    
    // 释放URL对象
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}); 