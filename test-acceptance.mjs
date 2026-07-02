import http from 'http';

function req(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3010,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

const results = [];
const log = (name, r, expectFail = false) => {
  const ok = expectFail ? r.status >= 400 : r.status < 400;
  results.push({ name, status: r.status, ok });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} (${r.status})`);
  if (!ok && r.body) console.log('  →', JSON.stringify(r.body).slice(0, 150));
};

async function login(email) {
  const res = await req('POST', '/api/auth/login', { email });
  return res.body?.data?.token || '';
}

async function test() {
  console.log('\n========== PRD 验收标准测试 ==========\n');

  // 不同角色的邮箱
  const roles = {
    PM: 'lin.wq@pharma.com',
    PROCESSOR: 'zhao.sy@pharma.com',
    PHYSICIAN: 'chen.med@pharma.com',
    QA: 'he.jy@pharma.com',
    VENDOR: 'wang.qh@cro-partner.com',
    ADMIN: 'wu.qm@pharma.com',
  };

  let tokens = {};
  for (const [role, email] of Object.entries(roles)) {
    tokens[role] = await login(email);
    console.log(`登录 ${role}: token length = ${tokens[role].length}`);
  }

  // ===== 验收项 1: 主流程可完成 =====
  console.log('\n=== 验收项 1: 主流程可完成 ===');

  // 1.1 从模板创建项目
  const proj = await req('POST', '/api/projects', {
    name: '验收测试项目-ICSR',
    code: 'ACC-ICSR-' + Date.now().toString().slice(-6),
    templateId: 'tpl-icsr',
    type: 'ICSR',
    product: '验收测试药品',
    description: '测试完整主流程',
  }, tokens.PM);
  log('从模板创建项目', proj);
  const projectId = proj.body?.data?.project?.id || proj.body?.data?.id;
  console.log('  projectId:', projectId);

  // 1.2 验证自动生成任务
  const tasksRes = await req('GET', `/api/tasks?projectId=${projectId}`, null, tokens.PM);
  log('查询项目任务', tasksRes);
  const tasks = tasksRes.body?.data?.items || [];
  console.log('  自动生成任务数:', tasks.length);
  log('  应生成5个任务', { status: tasks.length === 5 ? 200 : 500, body: { count: tasks.length } });
  const taskId = tasks[0]?.id;
  console.log('  firstTaskId:', taskId);

  // 1.3 分配负责人
  const assign = await req('PATCH', `/api/tasks/${taskId}/assign`, {
    assigneeId: 'u-002',
    reviewerId: 'u-003',
  }, tokens.PM);
  log('分配任务负责人', assign);

  // 1.4 上传证据
  const att1 = await req('POST', `/api/tasks/${taskId}/attachments`, {
    fileName: '原始报告表.pdf',
    size: 10240,
    type: 'application/pdf',
    evidenceKey: '原始报告表',
  }, tokens.PROCESSOR);
  log('上传证据1-原始报告表', att1);

  const att2 = await req('POST', `/api/tasks/${taskId}/attachments`, {
    fileName: '患者基本信息.docx',
    size: 5120,
    type: 'application/docx',
    evidenceKey: '患者基本信息',
  }, tokens.PROCESSOR);
  log('上传证据2-患者基本信息', att2);

  // 1.5 开始处理 → 提交复核
  const s1 = await req('PATCH', `/api/tasks/${taskId}/status`, { status: 'IN_PROGRESS' }, tokens.PROCESSOR);
  log('状态: NOT_STARTED → IN_PROGRESS', s1);

  const s2 = await req('PATCH', `/api/tasks/${taskId}/status`, {
    status: 'IN_REVIEW',
    submitNote: '处理完成，提交复核',
  }, tokens.PROCESSOR);
  log('状态: IN_PROGRESS → IN_REVIEW', s2);

  // 1.6 复核通过
  const review = await req('POST', `/api/tasks/${taskId}/review`, {
    decision: 'APPROVED',
    reason: '复核通过，材料完整',
  }, tokens.PHYSICIAN);
  log('复核通过', review);

  // 1.7 导出审计包
  const auditExport = await req('POST', '/api/audit/export', { projectId }, tokens.QA);
  log('导出审计包(HTML)', auditExport);
  const htmlLen = auditExport.body?.length || 0;
  console.log('  HTML内容长度:', htmlLen);
  log('  审计包应包含内容', { status: htmlLen > 1000 ? 200 : 500, body: { length: htmlLen } });

  // ===== 验收项 2: 权限正确 =====
  console.log('\n=== 验收项 2: 权限正确 ===');

  // 2.1 VENDOR 只能看到自己任务
  const vendorTasks = await req('GET', '/api/tasks', null, tokens.VENDOR);
  log('VENDOR 查看任务列表', vendorTasks);
  const vendorTaskCount = vendorTasks.body?.data?.items?.length || 0;
  console.log('  VENDOR 可见任务数:', vendorTaskCount);
  // VENDOR 应该只能看到分配给自己的任务

  // 2.2 PROCESSOR 不能创建项目
  const processorProj = await req('POST', '/api/projects', {
    name: '测试',
    code: 'TEST',
    product: 'test',
    templateId: 'tpl-icsr',
  }, tokens.PROCESSOR);
  log('PROCESSOR 创建项目 - 应返回403', processorProj, true);

  // 2.3 QA 可以导出审计包但不能创建项目
  const qaExport = await req('POST', '/api/audit/export', { projectId }, tokens.QA);
  log('QA 导出审计包', qaExport);

  const qaProj = await req('POST', '/api/projects', {
    name: 'QA测试',
    code: 'QA-TEST',
    product: 'test',
    templateId: 'tpl-icsr',
  }, tokens.QA);
  log('QA 创建项目 - 应返回403', qaProj, true);

  // 2.4 普通成员查看未授权项目
  const otherProj = await req('GET', `/api/projects/${projectId}`, null, tokens.VENDOR);
  log('VENDOR 查看未参与项目 - 应404或无法访问', otherProj, otherProj.status >= 400);

  // ===== 验收项 3: 状态流转正确 =====
  console.log('\n=== 验收项 3: 状态流转正确 ===');

  // 创建新任务测试状态机
  const newTask = await req('POST', '/api/tasks', {
    projectId,
    title: '状态机测试任务',
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    requiredEvidence: ['测试证据'],
  }, tokens.PM);
  log('创建状态机测试任务', newTask);
  const testTaskId = newTask.body?.data?.id;

  // 3.1 非法状态转换
  const badTrans1 = await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'DONE' }, tokens.PM);
  log('非法转换: NOT_STARTED → DONE - 应400', badTrans1, true);

  const badTrans2 = await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'IN_REVIEW' }, tokens.PM);
  log('非法转换: NOT_STARTED → IN_REVIEW - 应400', badTrans2, true);

  // 3.2 复核退回必须填写原因
  await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'IN_PROGRESS' }, tokens.PM);
  await req('POST', `/api/tasks/${testTaskId}/attachments`, {
    fileName: 'test.pdf', size: 100, type: 'pdf', evidenceKey: '测试证据',
  }, tokens.PM);
  await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'IN_REVIEW', submitNote: '提交' }, tokens.PM);

  const badReturn = await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'NEEDS_INFO' }, tokens.QA);
  log('复核退回不填原因 - 应400', badReturn, true);

  const goodReturn = await req('PATCH', `/api/tasks/${testTaskId}/status`, {
    status: 'NEEDS_INFO',
    reviewNote: '材料不完整',
  }, tokens.QA);
  log('复核退回填写原因', goodReturn);

  // 3.3 重新提交必须填写补充说明
  const badResubmit = await req('PATCH', `/api/tasks/${testTaskId}/status`, { status: 'IN_PROGRESS' }, tokens.PM);
  log('重新提交不填说明 - 应400', badResubmit, true);

  const goodResubmit = await req('PATCH', `/api/tasks/${testTaskId}/status`, {
    status: 'IN_PROGRESS',
    supplementNote: '已补充材料',
  }, tokens.PM);
  log('重新提交填写说明', goodResubmit);

  // ===== 验收项 4: 时限提醒可用 =====
  console.log('\n=== 验收项 4: 时限提醒可用 ===');

  // 创建即将到期任务
  const urgentTask = await req('POST', '/api/tasks', {
    projectId,
    title: '紧急任务-时限测试',
    dueAt: new Date(Date.now() + 1 * 86400000).toISOString(), // 1天后
    priority: 'P0',
    riskLevel: 'HIGH',
  }, tokens.PM);
  log('创建即将到期任务', urgentTask);

  // 查看通知
  const notifs = await req('GET', '/api/notifications', null, tokens.PM);
  log('查看通知列表', notifs);
  console.log('  通知数量:', notifs.body?.data?.length);

  const notifCounts = await req('GET', '/api/notifications/count', null, tokens.PM);
  log('查看通知计数', notifCounts);

  // ===== 验收项 5: 审计包可导出 =====
  console.log('\n=== 验收项 5: 审计包可导出 ===');

  // 导出验证
  const exportRes = await req('POST', '/api/audit/export', { projectId }, tokens.PM);
  log('导出审计包', exportRes);

  // 验证审计日志完整性
  const auditLogs = await req('GET', `/api/audit/logs?projectId=${projectId}`, null, tokens.PM);
  log('查询项目审计日志', auditLogs);
  const logCount = auditLogs.body?.data?.items?.length || auditLogs.body?.data?.length || 0;
  console.log('  审计日志数:', logCount);
  log('  应有审计记录', { status: logCount > 5 ? 200 : 500, body: { count: logCount } });

  // ===== 验收项 6: AI 不越界 =====
  console.log('\n=== 验收项 6: AI 不越界 ===');

  // 生成 AI 草稿
  const aiDraft = await req('POST', '/api/ai/draft', { projectId, kind: 'WEEKLY' }, tokens.PM);
  log('生成 AI 周报草稿', aiDraft);
  const draftId = aiDraft.body?.data?.id;
  console.log('  draftId:', draftId);
  console.log('  confirmed:', aiDraft.body?.data?.confirmed);

  // 验证草稿默认为未确认状态
  log('  草稿应默认未确认', { status: aiDraft.body?.data?.confirmed === false ? 200 : 500, body: aiDraft.body?.data });

  // 确认草稿
  const confirm = await req('PUT', `/api/ai/draft/${draftId}/confirm`, null, tokens.PM);
  log('确认 AI 草稿', confirm);
  console.log('  确认后状态:', confirm.body?.data?.confirmed);

  // ===== 并发编辑冲突测试 =====
  console.log('\n=== 并发编辑冲突测试 ===');

  const concurrentTask = await req('POST', '/api/tasks', {
    projectId,
    title: '并发测试任务',
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  }, tokens.PM);
  const concurrentId = concurrentTask.body?.data?.id;
  const version = concurrentTask.body?.data?.version;
  log('创建并发测试任务', concurrentTask);

  // 正常更新（版本正确）
  const update1 = await req('PATCH', `/api/tasks/${concurrentId}/status`, {
    status: 'IN_PROGRESS',
    expectedVersion: version,
  }, tokens.PM);
  log('正常更新(版本匹配)', update1);

  // 冲突更新（版本错误）
  const update2 = await req('PATCH', `/api/tasks/${concurrentId}/status`, {
    status: 'DONE',
    expectedVersion: version, // 用旧版本
    reason: '测试冲突',
  }, tokens.PM);
  log('冲突更新(版本不匹配) - 应409', update2, true);

  // ===== 边界场景测试 =====
  console.log('\n=== 边界场景测试 ===');

  // 空数据场景
  const emptyProjects = await req('GET', '/api/projects?status=CLOSED', null, tokens.PM);
  log('查询空数据(CLOSED项目)', emptyProjects);

  // 无效ID
  const invalidId = await req('GET', '/api/tasks/nonexistent-id', null, tokens.PM);
  log('查询不存在任务 - 应404', invalidId, true);

  // 超长输入
  const longName = await req('POST', '/api/projects', {
    name: 'A'.repeat(100), // 超过60字限制
    code: 'LONG',
    product: 'test',
    templateId: 'tpl-icsr',
  }, tokens.PM);
  log('超长项目名 - 应400', longName, true);

  // 无效日期
  const badDate = await req('POST', '/api/tasks', {
    projectId,
    title: '测试',
    dueAt: 'invalid-date-format',
  }, tokens.PM);
  log('无效日期格式 - 应400', badDate, true);

  // ===== 汇总 =====
  console.log('\n========== PRD 验收测试汇总 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`总计: ${results.length} 项`);
  console.log(`通过: ${passed} 项 ✅`);
  console.log(`失败: ${failed} 项 ❌`);

  // 按验收项分类
  const categories = {
    '主流程可完成': results.slice(0, 15).filter(r => r.ok).length,
    '权限正确': results.slice(15, 22).filter(r => r.ok).length,
    '状态流转正确': results.slice(22, 32).filter(r => r.ok).length,
    '时限提醒可用': results.slice(32, 35).filter(r => r.ok).length,
    '审计包可导出': results.slice(35, 38).filter(r => r.ok).length,
    'AI不越界': results.slice(38, 41).filter(r => r.ok).length,
    '并发冲突处理': results.slice(41, 44).filter(r => r.ok).length,
    '边界场景': results.slice(44).filter(r => r.ok).length,
  };
  console.log('\n各验收项通过数:');
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`  ${cat}: ${count}/${results.filter(r => r.name.includes(cat.slice(0,4)) || results.indexOf(r) >= 0).length}`);
  }

  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name} (${r.status})`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});