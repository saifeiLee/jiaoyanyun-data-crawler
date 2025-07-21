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

const grades = [
  "初中",
  "高中",
]

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startCollection') {
    console.log('开始采集数据, 科目:', message.subject);

    try {
      collectData()
        .then(data => {
          // 发送数据到background.js进行下载
          chrome.runtime.sendMessage({
            action: 'downloadData',
            data: data,
            filename: `知识树数据.json`
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
  if (message.action === 'startCollectVideo') {
    console.log('开始采集视频');
    try {
      const videoDataCollector = new VideoDataCollector();
      videoDataCollector.collectVideoData().then(data => {
        console.log('data:', data);
        sendResponse({ success: true });
      }).catch(error => {
        console.error('采集视频出错:', error);
        sendResponse({ success: false, error: error.message });
      });
      sendResponse({ success: true });
    } catch (error) {
      console.error('采集视频出错:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  return false;
});

// 主要数据采集函数
async function collectData() {
  const result = {}
  const startTime = new Date()
  for (const grade of grades) {
    try {
      // 1. 选择"高中"选项
      const gradeElement = await getGradesElement(grade);
      const parentElement = gradeElement.parentElement;
      console.log(`已选择${grade}`);
      const subjectData = {}

      for (const subject of subjects) {
        await selectSubject(parentElement, subject);
        console.log(`已选择${subject}学科`);
        const knowledgeTreeElement = await getKnowledgeTreeElement();
        if (!knowledgeTreeElement) {
          throw new Error(`未找到知识树标签`);
        }
        const knowledgeTreeData = await collectKnowledgeTreeData(knowledgeTreeElement);
        subjectData[subject] = knowledgeTreeData
      }
      result[grade] = subjectData
      const endTime = new Date()
      const duration = endTime - startTime
      console.log(`${grade}学科数据采集完成, 耗时: ${duration}ms`);

    } catch (error) {
      console.error('数据采集过程中出错:', error);
      throw error;
    }
  }
  return result
}

/**
 * 获取学段所在的DOM
 * @param {*} grade 学段. 高中 | 初中
 */
async function getGradesElement(grade = "高中") {
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
}

// 选择学科
async function selectSubject(parentElement, subjectName) {
  // 查找语文学科按钮或选项
  const subjectElements = parentElement.querySelectorAll('.el-select-dropdown__item');

  for (const element of subjectElements) {
    if (element.innerText.includes(subjectName)) {
      element.click();
      await sleep(200);
      return true;
    }
  }
}

// 选择知识树标签
async function getKnowledgeTreeElement() {
  // 查找并点击"知识树"或"知识点"标签
  const knowledgeTreeTab = document.querySelector('.el-aside.tk-select-left')
  // 只处理"新授课方法"
  // 1. 点击方法选择框,在下拉框里确保选中“新授课方法”
  const methodSelectBox = knowledgeTreeTab.querySelector('.el-input__suffix')
  methodSelectBox.click();
  await sleep(200);
  // 2. 在弹出的下拉框中查找“新授课方法”
  const methodOptions = document.querySelectorAll('.el-select-dropdown__item')
  for (const option of methodOptions) {
    if (option.innerText.includes('新授课方法')) {
      option.click();
      await sleep(200);
    }
  }

  if (knowledgeTreeTab) {
    knowledgeTreeTab.click();
    await sleep(200);
  }
  return knowledgeTreeTab;
}

// 采集知识树数据
async function collectKnowledgeTreeData(knowledgeTreeElement) {
  // 找到知识树的各个节点
  const knowledgePointsElement = knowledgeTreeElement.querySelectorAll('.el-tree-node')
  console.log('knowledgePointsElement', knowledgePointsElement)
  const result = []
  // 遍历每个节点
  for (const element of knowledgePointsElement) {
    console.log('element', element.innerText)
    const knowledgePointData = await extractKnowledgeTreeData(element);
    console.log('knowledgePointData', knowledgePointData)
    result.push(knowledgePointData)
  }
  return result
}

/**
 * 递归提取知识树数据
 * 叶子节点的class里有'is-leaf'
 * 所有节点的class都有'el-tree-node__expand-icon'
 * 节点展开后,class里有一个'expanded'
 * 树形知识点节点的选择器结构规律:
 *  .el-tree-node
 *    .el-tree-node__content
 *    .el-tree-node__children
 * @param {*} container 标签元素
 * @returns 返回树结构的知识点标签数据
 * 
 * 例如:
 * {
 *   "name": "集合",
 *   "children": [
 *     {
 *       "name": "集合的定义",
 *       "children": []
 *     }
 *   ]
 * }
 */
async function extractKnowledgeTreeData(container) {
  const targetElement = container.querySelector('.el-tree-node__content')
  const expandIconElement = targetElement.querySelector('.el-tree-node__expand-icon')
  const isLeaf = expandIconElement.classList.contains('is-leaf')
  const name = targetElement.innerText
  const expanded = expandIconElement.classList.contains('expanded')
  const children = []
  if (isLeaf) {
    return {
      name,
      children
    }
  }

  if (!isLeaf && !expanded) {
    // 展开节点
    expandIconElement.click()
    await sleep(200)
    // 获取子节点
    const childContainer = container.querySelector('.el-tree-node__children')
    const childNodes = childContainer.querySelectorAll('.el-tree-node')
    for (const childNode of childNodes) {
      const childNodeData = await extractKnowledgeTreeData(childNode)
      children.push(childNodeData)
    }
    // 收起节点
    expandIconElement.click()
    await sleep(200)
  }
  return {
    name,
    children
  }
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


/**
 * 获取视频数据
 *  */

const allSubjects = [
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


class VideoDataCollector {
  constructor() {
    this.subjects = allSubjects
  }

  async selectSubject(subjectName) {
    /**
     * 下拉框的层级接口：
     * <ul class="ant-cascader-menu" role="menu"><li class="ant-cascader-menu-item ant-cascader-menu-item-active" role="menuitemcheckbox" title="数学" aria-checked="true" data-path-key="1__RC_CASCADER_SPLIT__1"><div class="ant-cascader-menu-item-content">数学</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="化学" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__2"><div class="ant-cascader-menu-item-content">化学</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="生物" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__3"><div class="ant-cascader-menu-item-content">生物</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="英语" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__4"><div class="ant-cascader-menu-item-content">英语</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="语文" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__5"><div class="ant-cascader-menu-item-content">语文</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="物理" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__6"><div class="ant-cascader-menu-item-content">物理</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="政治" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__7"><div class="ant-cascader-menu-item-content">政治</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="地理" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__11"><div class="ant-cascader-menu-item-content">地理</div></li><li class="ant-cascader-menu-item" role="menuitemcheckbox" title="历史" aria-checked="false" data-path-key="1__RC_CASCADER_SPLIT__12"><div class="ant-cascader-menu-item-content">历史</div></li></ul>
     */
    // 直接找到选择框内的元素点击选中，无需触发下拉框
    const subjectElements = document.querySelectorAll('.ant-cascader-menu .ant-cascader-menu-item')
    for (const element of subjectElements) {
      // 检查title属性是否学科名
      if (element.getAttribute('title').includes(subjectName)) {
        console.log(`找到了学科: ${subjectName}`);
        element.click();
        await sleep(200);
        return true;
      }
    }
  }

  /**
   * 选择知识点，并采集视频信息
   */
  async selectKnowledgePointAndCollectVideoInfo() {
    let result = []
    const knowledgePointQuery = `.ant-tree-list-holder-inner`
    const knowledgePointElement = document.querySelector(knowledgePointQuery)
    if (!knowledgePointElement) {
      throw new Error(`未找到知识点选择框: ${knowledgePointQuery}`);
    }
    const knowledgePointElements = knowledgePointElement.querySelectorAll('.ant-tree-treenode')
    console.log('knowledgePointElements:', knowledgePointElements)
    for (const element of knowledgePointElements) {
      const knowledgePointName = element.querySelector('.ant-tree-title').innerText
      console.log(`找到了知识点: ${knowledgePointName}`)
      const checkboxElement = element.querySelector('.ant-tree-checkbox')
      // 单击checkbox元素，触发知识点选择
      checkboxElement.click()
      await sleep(2000)
      const videoInfo = await this.collectVideoInfo()
      console.log(`采集到了视频信息: ${videoInfo}`)
      result.push({
        knowledgePointName,
        videoInfo
      })
      // 取消知识点选择
      checkboxElement.click()
      await sleep(2000)
    }
    return result
  }

  async collectVideoInfo() {
    const videoListQuery = `.video-list .video-list-content .list-ul`
    const videoListContainerElm = document.querySelectorAll(videoListQuery)
    if (!videoListContainerElm) {
      throw new Error(`未找到视频列表容器: ${videoListQuery}`);
    }
    // 获取所有的<li>元素
    const videoListElements = videoListContainerElm.querySelectorAll('li')
    const result = []
    for (const element of videoListElements) {
      let data = {}
      const videoCard = element.querySelector('.video-card')
      const videoInfo = element.querySelector('.video-info')
      // 获取封面信息
      const coverElement = videoCard.querySelector('.cover-info')
      // 封面相关的dom结构:
      // <div class="cover-info"><img src="https://imgs.genshuixue.com/00-x-upload/image/207790829_c8545926f5253673d26ed1091342bf00_3y233GpW.jpg" class="cover-img"><span class="vid-time">00:11:03</span></div>
      const coverUrl = coverElement.querySelector('.cover-img').src
      const videoTime = coverElement.querySelector('.vid-time').innerText
      data["coverUrl"] = coverUrl
      data["duration"] = videoTime

      // 获取视频基本信息
      // 视频信息相关的DOM结构:
      // <div class="video-info" id="cover-12132251322026227"><div class="vid-name"><span>【知识】【学院派】词语辨析方法</span><div class="cus-labels undefined"><div class="cus-inner-wrap" id="12132251322026227-cus-inner-wrap"><span id="12132251322026227_马一鸣" class="12132251322026227-label-tag teacher-tag">马一鸣</span><span id="12132251322026227_词语辨析" class="12132251322026227-label-tag know-label-tag">词语辨析</span><span class="rest-node label-tag" id="12132251322026227-rest-node" style="display: none;">···</span></div></div></div><button type="button" class="ant-btn css-x93v21 ant-btn-text ant-dropdown-trigger video-list-menu"><span role="img" aria-label="menu" class="anticon anticon-menu" style="color: rgb(34, 102, 255);"><svg viewBox="64 64 896 896" focusable="false" data-icon="menu" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M904 160H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zm0 624H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zm0-312H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8z"></path></svg></span></button></div>
      const videoNameElement = videoInfo.querySelector('.vid-name')
      const videoName = videoNameElement.querySelector('span').innerText
      data["name"] = videoName
      const videoTeacherElement = videoInfo.querySelector('.teacher-tag')
      const videoTeacher = videoTeacherElement.innerText
      data["teacher"] = videoTeacher
      const videoKnowLabelElement = videoInfo.querySelector('.know-label-tag')
      const videoKnowLabel = videoKnowLabelElement.innerText
      const labels = [videoKnowLabel]
      data["labels"] = labels

      result.push(data)
    }
    console.log('收集到的信息:', result)
    return result
  }


  async collectVideoData() {
    for (const subject of this.subjects) {
      await this.selectSubject(subject);
      const videoInfo = await this.selectKnowledgePointAndCollectVideoInfo();
      console.log('videoInfo:', videoInfo)
      return videoInfo;
    }
  }
}

// async function startCollectVideo() {
//   const videoDataCollector = new VideoDataCollector();
//   await videoDataCollector.collectVideoData();
//   return { success: true };
// }
