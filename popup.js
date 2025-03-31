document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startCollection');
  const statusDiv = document.getElementById('status');
  const subjectSelect = document.getElementById('subject');
  const gradeSelect = document.getElementById('grade');

  // 初始化下拉选项
  initializeOptions();

  // 加载保存的值
  chrome.storage.local.get(['subject', 'grade'], function(result) {
    if (result.subject) {
      subjectSelect.value = result.subject;
    }
    if (result.grade) {
      gradeSelect.value = result.grade;
    }
  });

  startButton.addEventListener('click', async () => {
    // 获取选择的值
    const subject = subjectSelect.value || '语文';
    const grade = gradeSelect.value || '高中';
    
    // 保存到存储
    chrome.storage.local.set({ 
      subject: subject,
      grade: grade 
    });
    
    statusDiv.textContent = '正在采集数据...';
    statusDiv.className = 'status collecting';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startCollection',
        subject: subject,
        grade: grade
      });
      
      if (response && response.success) {
        statusDiv.textContent = '数据采集完成！';
        statusDiv.className = 'status success';
      } else {
        statusDiv.textContent = '采集失败：' + (response?.error || '未知错误');
        statusDiv.className = 'status error';
      }
    } catch (error) {
      statusDiv.textContent = '发生错误：' + (error.message || '无法连接到页面');
      statusDiv.className = 'status error';
    }
  });

  // 初始化下拉选项
  function initializeOptions() {
    // 添加年级选项
    const grades = ['高中', '初中', '小学'];
    grades.forEach(grade => {
      const option = document.createElement('option');
      option.value = grade;
      option.textContent = grade;
      if (grade === '高中') option.selected = true;
      gradeSelect.appendChild(option);
    });

    // 添加学科选项
    const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
    subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      if (subject === '语文') option.selected = true;
      subjectSelect.appendChild(option);
    });
  }
}); 