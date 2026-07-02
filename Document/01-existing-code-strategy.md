# 现有代码处理方式

> 日期：2026-06-29
> 用途：说明第一批开发如何修改现有 MVP 代码，明确保留、扩展和重构的范围。

---

## 一、现有代码结构总览

当前 `app.js` 共 773 行，核心结构如下：

```
app.js
├── 常量定义（STORAGE_KEY, ROLES）
├── seedState（演示数据，包含 3 个项目、6 个任务）
├── 工具函数（structuredCloneSafe, getRoleInfo）
├── 状态管理（loadState, saveState）
├── 渲染函数
│   ├── renderPharmacy()          // 项目驾驶舱
│   ├── renderTasks()             // 任务工作台（列表视图）
│   ├── renderTemplates()         // 项目模板
│   ├── renderAudit()             // 审计日志
│   ├── renderToast()             // Toast 提示
│   └── renderNavigation()        // 导航栏
├── 事件处理
│   ├── openProjectDialog()       // 打开创建项目弹窗
│   ├── openTaskDetail()          // 打开任务详情弹窗
│   ├── handleStatusChange()      // 处理状态变更
│   ├── addComment()              // 添加评论
│   ├── attachEvidence()          // 模拟上传证据
│   └── addAudit()                // 添加审计日志
└── 初始化（init()）
```

`index.html` 包含：
- 导航栏（项目驾驶舱、我的任务、项目模板、审计日志）
- 页面标题区（动态标题 + 角色提示）
- 4 个视图容器（pharmacy、tasks、templates、audit）
- 3 个弹窗（创建项目、任务详情、通知 Toast）

---

## 二、保留不变的核心代码

以下代码在第一批开发中**完全保留，不做任何修改**：

### 1. 角色与权限系统

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `ROLES` 常量 | 保留 | 5 个角色定义不变 |
| `getRoleInfo(role)` | 保留 | 角色信息获取逻辑不变 |
| `els.roleSelect` 事件监听 | 保留 | 角色切换逻辑不变 |
| `permissions` 判断逻辑 | 保留 | 现有权限校验不变 |

### 2. 状态流转核心逻辑

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `STATUS_CONFIG` | 保留 | 5 个状态定义不变 |
| `handleStatusChange()` 核心逻辑 | 保留 | 状态转换规则不变 |
| 状态转换的权限校验 | 保留 | PM/Physician/QA 复核权限不变 |

### 3. 审计日志核心机制

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `addAudit()` 函数 | 保留 | 审计日志写入逻辑不变 |
| `renderAudit()` 函数 | 保留 | 审计日志展示逻辑不变 |
| `audit-export` 功能 | 保留 | 导出逻辑不变 |

### 4. 评论与证据上传

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `addComment()` 函数 | 保留 | 评论添加逻辑不变 |
| `attachEvidence()` 函数 | 保留 | 证据上传模拟逻辑不变 |
| 评论列表渲染 | 保留 | 评论展示逻辑不变 |

### 5. 项目模板系统

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `TEMPLATES` 常量 | 保留并扩展节点字段 | 模板基础结构不变，增加 `dependsOn` 和 `regulatoryDeadline` 字段 |
| `renderTemplates()` | 保留 | 模板展示逻辑不变 |
| `createFromTemplate()` | 扩展 | 增加基于新字段生成任务的逻辑 |

### 6. 数据持久化

| 代码 | 处理方式 | 理由 |
|---|---|---|
| `STORAGE_KEY` | 保留 | 存储键不变 |
| `saveState()` | 保留 | 保存逻辑不变 |
| `loadState()` | 扩展 | 增加新字段的兼容性填充 |

---

## 三、需要扩展的代码

### 1. seedState 数据结构扩展

**现有结构**：
```javascript
const seedState = {
  currentRole: "pm",
  projects: [...],
  tasks: [...],
  audit: [...],
  templates: [...]
};
```

**扩展后结构**：
```javascript
const seedState = {
  currentRole: "pm",
  projects: [...],      // 增加 dayZero, regulatoryRule, caseType, followUpCount, submissions
  tasks: [...],         // 增加 dependsOn, blocked, seriousness, causality, meddraPt, meddraLlt, medicalOpinion, signalFlag, followUpRound, sopDeviation, customValues
  audit: [...],         // action 增加枚举值
  templates: [...],     // 节点增加 dependsOn, regulatoryDeadline, requiredFields
  // ===== 新增顶层字段 =====
  notifications: [],    // 通知中心数据
  activities: []        // 最近活动动态流
};
```

**处理方式**：
- 在现有 `seedState` 定义中直接追加新字段
- 现有演示数据的项目和任务对象中补充新字段（用空值或默认值填充）
- `loadState()` 中增加兼容性处理：如果旧数据缺少新字段，用 `seedState` 的默认值填充

### 2. loadState() 兼容迁移

**现有代码**：
```javascript
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(seedState);
    return JSON.parse(raw);
  } catch { return structuredCloneSafe(seedState); }
}
```

**扩展方式**：
```javascript
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(seedState);
    const parsed = JSON.parse(raw);
    // 兼容旧数据：如果缺少新字段，用 seedState 的默认值填充
    return {
      ...structuredCloneSafe(seedState),
      ...parsed,
      notifications: parsed.notifications || [],
      activities: parsed.activities || []
    };
  } catch { return structuredCloneSafe(seedState); }
}
```

### 3. createFromTemplate() 扩展

**现有逻辑**：根据模板节点生成任务，使用 `days` 计算相对截止日。

**扩展逻辑**：
- 如果模板节点有 `regulatoryDeadline`，使用法规时限规则计算绝对截止日
- 如果模板节点有 `dependsOn`，在生成的任务中设置 `dependsOn` 字段
- 根据 `requiredFields` 预填任务的必填字段标记

### 4. renderPharmacy() 扩展

**现有逻辑**：展示统计卡片、高风险任务列表、项目概览。

**扩展逻辑**：
- 统计卡片增加「临近法规截止」统计
- 高风险任务列表增加「法规时限预警」标签（显示距离法规截止剩余天数）
- 右侧增加「最近活动」面板（动态流，取 `state.activities` 的前 10 条）

### 5. renderTasks() 扩展

**现有逻辑**：列表视图展示任务，支持搜索和筛选。

**扩展逻辑**：
- 任务行增加「法规截止日」列（或 hover 提示）
- 被阻塞的任务显示「阻塞」标签
- 逾期任务增加「已逾期 N 天」提示

### 6. handleStatusChange() 扩展

**现有逻辑**：更新任务状态，记录审计日志，触发 toast。

**扩展逻辑**：
- 状态变更后，检查是否有后续任务依赖本任务，如果是「已完成」则解除阻塞
- 状态变更后，生成活动记录写入 `state.activities`

---

## 四、需要重构的代码

### 1. 任务详情弹窗（最大改动）

**现有结构**：单一评论区
```html
<div id="taskDetail">
  <h2>任务标题</h2>
  <div class="actions">...</div>
  <div class="comments-list">...</div>
  <div class="comment-form">...</div>
</div>
```

**重构为**：多标签页结构
```html
<div id="taskDetail">
  <h2>任务标题</h2>
  <div class="actions">...</div>
  <div class="tabs">
    <button data-tab="comments">评论与结论</button>
    <button data-tab="followup">随访</button>
    <button data-tab="medical">医学评估</button>
    <button data-tab="submission">监管提交</button>
    <button data-tab="evidence">证据与日志</button>
  </div>
  <div class="tab-content" data-tab="comments">...</div>
  <div class="tab-content" data-tab="followup">...</div>
  ...
</div>
```

**处理方式**：
- `openTaskDetail()` 函数中，将原有的评论渲染逻辑迁移到「评论与结论」标签页
- 新增「随访」「医学评估」「监管提交」「证据与日志」四个标签页的渲染函数
- 标签页切换通过 CSS `display` 控制，不重新渲染整个弹窗
- 原有评论和证据上传的 DOM 结构和事件监听保持不变，只做容器迁移

### 2. 导航栏扩展

**现有结构**：4 个导航项
```html
<nav>
  <button data-view="pharmacy">项目驾驶舱</button>
  <button data-view="tasks">我的任务</button>
  <button data-view="templates">项目模板</button>
  <button data-view="audit">审计日志</button>
</nav>
```

**重构为**：5 个导航项 + 通知铃铛
```html
<nav>
  <button data-view="pharmacy">项目驾驶舱</button>
  <button data-view="tasks">我的任务</button>
  <button data-view="templates">项目模板</button>
  <button data-view="audit">审计日志</button>
  <button data-view="notifications">通知中心</button>
  <button id="notificationBell">🔔 <span class="badge">3</span></button>
</nav>
```

**处理方式**：
- 在现有导航 HTML 中追加「通知中心」按钮和铃铛图标
- `renderNavigation()` 增加通知角标渲染逻辑
- 新增 `renderNotifications()` 函数渲染通知列表页面

---

## 五、需要新增的代码

### 1. 法规时限计算函数

```javascript
function calculateRegulatoryDeadline(dayZero, rule) {
  const deadlines = {
    "NMPA-15d": 15,
    "NMPA-非严重-30d": 30,
    "EMA-15d": 15,
    "FDA-15d": 15,
    "custom": null
  };
  const days = deadlines[rule];
  if (!days || !dayZero) return null;
  const date = new Date(dayZero);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getDaysUntilDeadline(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
```

### 2. 通知生成函数

```javascript
function generateNotifications() {
  // 遍历所有任务，根据规则生成通知
  // 规则：截止前 24h / 4h / 逾期 / 复核退回 / 证据缺失
}

function addNotification(notification) {
  // 写入 state.notifications
  // 更新导航栏角标
}
```

### 3. 活动记录函数

```javascript
function addActivity(activity) {
  // 写入 state.activities，保持最近 50 条
}
```

### 4. 标签页渲染函数

```javascript
function renderTaskDetailComments(task) { ... }
function renderTaskDetailFollowUp(task) { ... }
function renderTaskDetailMedical(task) { ... }
function renderTaskDetailSubmission(task) { ... }
function renderTaskDetailEvidence(task) { ... }
```

---

## 六、修改范围汇总

| 文件 | 修改类型 | 改动量估算 |
|---|---|---|
| `app.js` | 扩展 + 重构 | 新增约 350 行，修改约 100 行 |
| `index.html` | 扩展 | 新增通知导航项、铃铛图标、通知页面容器 |
| `styles.css` | 扩展 | 新增标签页样式、通知样式、法规时限样式 |

---

## 七、风险缓解

### 风险 1：任务详情重构导致原有评论功能损坏

**缓解**：重构时保留原有评论相关的 DOM class 名和事件监听逻辑，只做容器迁移。重构完成后，单独测试评论添加、展示、证据上传功能。

### 风险 2：数据兼容性导致旧数据加载失败

**缓解**：`loadState()` 中使用 `...structuredCloneSafe(seedState)` 展开默认值，再用 `...parsed` 覆盖已有数据。确保旧数据缺少的新字段自动填充默认值。

### 风险 3：新增功能影响渲染性能

**缓解**：通知中心和动态流的数据量控制在最近 20-50 条，不加载历史全部数据。标签页切换使用 CSS display 控制，不重新渲染整个弹窗。
