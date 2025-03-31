// 监听来自弹出窗口的消息
const subjects = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "政治",
  "历史",
  "地理",
]

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startCollection') {
    console.log('开始采集数据, 科目:', message.subject);

    try {
      collectData(message.subject)
        .then(data => {
          // 发送数据到background.js进行下载
          chrome.runtime.sendMessage({
            action: 'downloadData',
            data: data,
            filename: `${message.subject}_知识树数据.json`
          });

          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('采集数据出错:', error);
          sendResponse({ success: false, error: error.message });
        });

      // 异步响应
      return true;
    } catch (error) {
      console.error('采集数据出错:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  return false;
});

// 主要数据采集函数
async function collectData() {
  try {
    // 1. 选择"高中"选项
    // await selectHighSchool();
    const grade = '高中';
    const gradeElement = await getGradesElement(grade);
    const parentElement = gradeElement.parentElement;
    console.log('已选择高中');

    for (const subject of subjects) {
      await selectSubject(parentElement, subject);
      console.log(`已选择${subject}学科`);
      
    }

  } catch (error) {
    console.error('数据采集过程中出错:', error);
    throw error;
  }
}

/**
 * 获取学段所在的DOM
 * @param {*} grade 学段. 高中 | 初中
 */
async function getGradesElement(grade="高中") {
  const gradeElement = document.querySelectorAll('.el-select-group__title');
  if (!gradeElement) {
    throw new Error(`未找到学段: ${grade}`);
  }

  for (const element of gradeElement) {
    if (element.innerText.includes(grade)) {
      console.log('找到了学段:', element);
      return element;
    }
  }

  // throw new Error(`未找到学段: ${grade}`);
}

// 选择学科
async function selectSubject(parentElement, subjectName) {
  // 查找语文学科按钮或选项
  const subjectElements = parentElement.querySelectorAll('.el-select-dropdown__item');

  for (const element of subjectElements) {
    if (element.innerText.includes(subjectName)) {
      element.click();
      await sleep(1000);
      return true;
    }
  }

  // 可能需要先点击学科筛选按钮
  const subjectFilterBtn = document.querySelector('.学科按钮, button:contains("学科")');
  if (subjectFilterBtn) {
    subjectFilterBtn.click();
    await sleep(500);

    // 在弹出的下拉菜单中查找语文
    const subjectOption = Array.from(document.querySelectorAll('.下拉菜单 .选项, li, .option-item'))
      .find(el => el.textContent.includes(subjectName));

    if (subjectOption) {
      subjectOption.click();
      await sleep(1000);
      return true;
    }
  }

  throw new Error(`未找到${subjectName}学科选项`);
}

// 选择知识树标签
async function selectKnowledgeTree() {
  // 查找并点击"知识树"或"知识点"标签
  const knowledgeTreeTab = Array.from(document.querySelectorAll('.tab, .标签页, .nav-item'))
    .find(el => el.textContent.includes('知识点') || el.textContent.includes('知识树'));

  if (knowledgeTreeTab) {
    knowledgeTreeTab.click();
    await sleep(1000);
    return true;
  }

  // 如果已经在知识树页面，无需点击
  const isKnowledgeTreeActive = document.querySelector('.知识树.active, .知识点.active, .知识点树');
  if (isKnowledgeTreeActive) {
    return true;
  }

  console.warn('未找到知识树标签，继续尝试采集数据');
  return false;
}

// 采集知识树数据
async function collectKnowledgeTreeData() {
  // 找到知识树容器
  const treeContainer = document.querySelector('.知识树, .tree-component, .知识点树, .知识树内容区');
  if (!treeContainer) {
    // 尝试更通用的选择器
    const possibleContainers = [
      '.tree',
      '[role="tree"]',
      '.knowledge-tree',
      '.tree-view',
      // 根据图片中的结构
      '.知识树树形结构',
      '#知识树内容'
    ];

    for (const selector of possibleContainers) {
      const container = document.querySelector(selector);
      if (container) {
        return await extractKnowledgeTreeData(container);
      }
    }

    throw new Error('未找到知识树容器');
  }

  return await extractKnowledgeTreeData(treeContainer);
}

// 递归提取知识树数据
async function extractKnowledgeTreeData(container) {
  // 查找所有顶级知识点
  const topLevelItems = container.querySelectorAll(':scope > li, :scope > .tree-node, :scope > .tree-item, :scope > .知识点');

  if (topLevelItems.length === 0) {
    // 更通用的方法：查找所有看起来像树节点的元素
    const allTreeItems = container.querySelectorAll('.tree-node, .知识点, .tree-item, [role="treeitem"]');

    if (allTreeItems.length > 0) {
      return await buildTreeFromFlatItems(allTreeItems);
    }

    console.warn('在容器中未找到知识点', container);
    return [];
  }

  const result = [];

  for (const item of topLevelItems) {
    const itemData = {
      name: getNodeText(item),
      id: item.getAttribute('id') || item.getAttribute('data-id') || generateId(getNodeText(item))
    };

    // 检查是否可以展开
    const expandButton = item.querySelector('.expand-icon, .折叠图标, .arrow, [aria-expanded="false"]');
    if (expandButton) {
      // 点击展开
      expandButton.click();
      await sleep(500);

      // 查找子项容器
      const childContainer = item.querySelector('.children, .child-items, ul, [role="group"]');
      if (childContainer) {
        itemData.children = await extractKnowledgeTreeData(childContainer);
      }
    } else {
      // 已经展开或无子节点
      const childContainer = item.querySelector('.children, .child-items, ul, [role="group"]');
      if (childContainer) {
        itemData.children = await extractKnowledgeTreeData(childContainer);
      } else {
        itemData.children = [];
      }
    }

    result.push(itemData);
  }

  return result;
}

// 从扁平树项构建层次结构
async function buildTreeFromFlatItems(items) {
  // 用于存储节点间关系的映射
  const nodeMap = new Map();
  const result = [];

  // 首先收集所有节点信息和层级
  for (const item of items) {
    const id = item.getAttribute('id') || item.getAttribute('data-id') || generateId(getNodeText(item));
    const level = getNodeLevel(item);

    nodeMap.set(item, {
      id,
      name: getNodeText(item),
      level,
      children: [],
      element: item
    });
  }

  // 构建层次结构
  const itemsArray = Array.from(items);

  for (let i = 0; i < itemsArray.length; i++) {
    const currentItem = itemsArray[i];
    const currentNodeData = nodeMap.get(currentItem);

    // 检查是否可以展开
    const expandButton = currentItem.querySelector('.expand-icon, .折叠图标, .arrow, [aria-expanded="false"]');
    if (expandButton) {
      // 点击展开
      expandButton.click();
      await sleep(300);
    }

    if (i === itemsArray.length - 1 || nodeMap.get(itemsArray[i + 1]).level <= currentNodeData.level) {
      // 没有子节点
      currentNodeData.children = [];
    } else {
      // 有子节点，收集直接子节点
      let j = i + 1;
      while (j < itemsArray.length && nodeMap.get(itemsArray[j]).level > currentNodeData.level) {
        const childNodeData = nodeMap.get(itemsArray[j]);

        if (childNodeData.level === currentNodeData.level + 1) {
          // 直接子节点
          currentNodeData.children.push(childNodeData);
        }
        j++;
      }
    }

    // 如果是顶级节点，加入结果数组
    if (currentNodeData.level === 1) {
      result.push(currentNodeData);
    }
  }

  // 移除循环引用
  const cleanResult = cleanupTreeData(result);
  return cleanResult;
}

// 清理树数据，移除循环引用和不需要的属性
function cleanupTreeData(nodes) {
  return nodes.map(node => {
    const cleanNode = {
      id: node.id,
      name: node.name,
      children: node.children.length > 0 ? cleanupTreeData(node.children) : []
    };
    return cleanNode;
  });
}

// 获取节点级别
function getNodeLevel(element) {
  // 从class名称判断
  const classNames = element.className.split(' ');
  for (const className of classNames) {
    if (className.includes('level-')) {
      const match = className.match(/level-(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }

  // 从缩进判断
  const indent = parseInt(getComputedStyle(element).paddingLeft) ||
    parseInt(getComputedStyle(element).marginLeft);
  if (indent) {
    return Math.floor(indent / 20) + 1; // 假设每级缩进20px
  }

  // 从DOM结构判断
  let parent = element.parentElement;
  let level = 1;

  while (parent) {
    if (parent.tagName === 'UL' || parent.tagName === 'OL' ||
      parent.classList.contains('tree-node') ||
      parent.classList.contains('tag-item')) {
      level++;
    }
    parent = parent.parentElement;
  }

  return level;
}

// 获取节点文本
function getNodeText(element) {
  // 尝试找到文本内容元素
  const labelElement = element.querySelector('.label, .name, .title');
  if (labelElement) {
    return labelElement.textContent.trim();
  }

  // 直接获取文本，排除子节点文本
  let text = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent.trim();
    }
  }

  if (text) return text;

  // 如果上述方法都失败，返回所有文本
  return element.textContent.trim();
}

// 生成唯一ID
function generateId(text) {
  return 'node_' + text.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 10000);
}

// 辅助函数：休眠
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 等待元素出现
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
      } else {
        reject(new Error(`等待元素超时: ${selector}`));
      }
    }, timeout);
  });
} 