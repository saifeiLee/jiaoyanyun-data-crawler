// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadData') {
    console.log('准备下载...')
    // 创建格式化的JSON数据
    const jsonString = JSON.stringify(message.data, null, 2);
    
    // 使用传入的文件名，或生成时间戳文件名
    const filename = message.filename || 
      `知识树数据_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    // 创建一个无格式的data URL，不使用base64编码，直接使用JSON文本
    // 这样可以保持文件的可读性
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载错误:', chrome.runtime.lastError);
      } else {
        console.log('文件下载开始，ID:', downloadId);
      }
    });
  }
}); 