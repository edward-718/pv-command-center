import http from 'http';

function req(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3010,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const r = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: chunks, headers: res.headers });
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
  if (!ok) console.log('  →', JSON.stringify(r.body).slice(0, 200));
};

let token = '';
let projectId = '';
let taskId = '';
let aiDraftId = '';
let attachmentId = '';

async function test() {
  console.log('========== 全面 API 测试 v2 ==========\n');

  // ---- 1. 认证 API ----
  console.log('=== 1. 认证 API ===');
  
  const login = await req('POST', '/api/auth/login', { email: 'lin.wq@pharma.com' });
  token = login.body?.data?.token || '';
  log('POST /auth/login', login);

  const me = await req('GET', '/api/auth/me', null, token);
  log('GET /auth/me', me);

  const users = await req('GET', '/api/auth/users', null, token);
  log('GET /auth/users', users);

  const noAuth = await req('GET', '/api/projects');
  log('GET /projects (无Token) - 应返回401', noAuth, true);

  // ---- 2. 项目 API ----
  console.log('\n=== 2. 项目 API ===');

  // 测试输入校验
  const badProj1 = await req('POST', '/api/projects', { name: '', code: 'TEST' }, token);
  log('POST /projects (name为空) - 应返回400', badProj1, true);

  const badProj2 = await req('POST', '/api/projects', { name: '测试', code: '' }, token);
  log('POST /projects (code为空) - 应返回400', badProj2, true);

  const newProj = await req('POST', '/api/projects', {
    name: '测试项目-模板生成',
    code: 'TPL-' + Date.now().toString().slice(-6),
    templateId: 'tpl-icsr',
    type: 'ICSR',
    product: '测试药品A',
    description: '测试从模板自动生成任务',
  }, token);
  log('POST /projects (从模板创建)', newProj);
  projectId = newProj.body?.data?.project?.id || newProj.body?.data?.id || '';
  console.log('  projectId:', projectId);
  // 检查是否自动生成了任务
  const tasksAfterCreate = await req('GET', `/api/tasks?projectId=${projectId}`, null, token);
  const taskCount = tasksAfterCreate.body?.data?.items?.length || tasksAfterCreate.body?.data?.length || 0;
  log(`  → 自动生成任务数: ${taskCount}`, { status: taskCount > 0 ? 200 : 500, body: 'count check' });
  if (taskCount > 0) {
    taskId = tasksAfterCreate.body.data.items[0].id;
    console.log('  firstTaskId:', taskId);
  }

  const projDetail = await req('GET', `/api/projects/${projectId}`, null, token);
  log('GET /projects/:id (详情)', projDetail);

  const updProj = await req('PUT', `/api/projects/${projectId}`, { description: '更新后的描述' }, token);
  log('PUT /projects/:id (更新)', updProj);

  const projects1 = await req('GET', '/api/projects?status=ACTIVE', null, token);
  log('GET /projects?status=ACTIVE (筛选)', projects1);

  // ---- 3. 任务 API ----
  console.log('\n=== 3. 任务 API ===');

  if (!taskId) {
    const newTask = await req('POST', '/api/tasks', {
      projectId,
      title: '测试任务-完整流程',
      description: '测试任务的完整描述信息',
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'P2',
      riskLevel: 'MEDIUM',
      requiredEvidence: ['原始报告表', '患者基本信息'],
    }, token);
    log('POST /tasks (创建任务)', newTask);
    taskId = newTask.body?.data?.id || '';
  }

  // 输入校验测试
  const badTask = await req('POST', '/api/tasks', {
    projectId,
    title: '',
    dueAt: 'invalid-date',
  }, token);
  log('POST /tasks (无效输入) - 应返回400', badTask, true);

  const taskDetail = await req('GET', `/api/tasks/${taskId}`, null, token);
  log('GET /tasks/:id (详情)', taskDetail);
  console.log('  evidenceCompleteness:', taskDetail.body?.data?.evidenceCompleteness);

  // 状态流转
  const s1 = await req('PATCH', `/api/tasks/${taskId}/status`, { status: 'IN_PROGRESS' }, token);
  log('PATCH status: NOT_STARTED → IN_PROGRESS', s1);

  const s2 = await req('PATCH', `/api/tasks/${taskId}/status`, {
    status: 'IN_REVIEW',
    submitNote: '提交复核测试',
  }, token);
  log('PATCH status: IN_PROGRESS → IN_REVIEW (证据不全，应失败)', s2, true);
  console.log('  missingEvidence:', s2.body?.missingEvidence || s2.body?.message);

  // 任务列表筛选
  const taskList1 = await req('GET', '/api/tasks?page=1&pageSize=10', null, token);
  log('GET /tasks (列表+分页)', taskList1);

  const taskList2 = await req('GET', `/api/tasks?projectId=${projectId}`, null, token);
  log('GET /tasks?projectId= (按项目筛选)', taskList2);

  const taskList3 = await req('GET', '/api/tasks?status=IN_PROGRESS', null, token);
  log('GET /tasks?status= (按状态筛选)', taskList3);

  // 分页参数校验
  const badPage = await req('GET', '/api/tasks?page=0&pageSize=0', null, token);
  log('GET /tasks (无效分页参数) - 应返回400', badPage, true);

  // 任务分配
  const assign = await req('PATCH', `/api/tasks/${taskId}/assign`, { assigneeId: 'u-002' }, token);
  log('PATCH /tasks/:id/assign (分配任务)', assign);

  // 任务评论
  const comment = await req('POST', `/api/tasks/${taskId}/comments`, { content: '这是一条测试评论' }, token);
  log('POST /tasks/:id/comments (添加评论)', comment);

  // 任务附件
  const attachment = await req('POST', `/api/tasks/${taskId}/attachments`, {
    fileName: '测试文件.pdf',
    size: 10240,
    type: 'application/pdf',
    evidenceKey: '原始报告表',
  }, token);
  log('POST /tasks/:id/attachments (上传附件)', attachment);
  attachmentId = attachment.body?.data?.id || '';
  console.log('  attachmentId:', attachmentId);

  // 附件软删除
  if (attachmentId) {
    const delAtt = await req('DELETE', `/api/tasks/${taskId}/attachments/${attachmentId}`, null, token);
    log('DELETE /tasks/:id/attachments/:id (软删除附件)', delAtt);
  }

  // ---- 4. 驾驶舱 API ----
  console.log('\n=== 4. 驾驶舱 API ===');

  const dash = await req('GET', '/api/dashboard', null, token);
  log('GET /dashboard (统计概览)', dash);
  console.log('  overview.totalTasks:', dash.body?.data?.overview?.totalTasks);
  console.log('  taskMetrics.evidenceCompletenessRate:', dash.body?.data?.taskMetrics?.evidenceCompletenessRate);

  const kpis = await req('GET', '/api/dashboard/kpis', null, token);
  log('GET /dashboard/kpis (KPI详情)', kpis);
  console.log('  northStar.value:', kpis.body?.data?.northStar?.value);

  // ---- 5. 模板 API ----
  console.log('\n=== 5. 模板 API ===');

  const tpls = await req('GET', '/api/templates', null, token);
  log('GET /templates (列表)', tpls);

  const tplDetail = await req('GET', '/api/templates/tpl-icsr', null, token);
  log('GET /templates/:id (详情)', tplDetail);
  console.log('  node count:', tplDetail.body?.data?.nodes?.length);

  // ---- 6. 审计 API ----
  console.log('\n=== 6. 审计 API ===');

  const audit = await req('GET', '/api/audit/logs?page=1&pageSize=10', null, token);
  log('GET /audit/logs (列表+分页)', audit);

  const auditBadPage = await req('GET', '/api/audit/logs?page=-1&pageSize=1000', null, token);
  log('GET /audit/logs (无效分页) - 应返回400', auditBadPage, true);

  const auditTask = await req('GET', `/api/audit/logs/TASK/${taskId}`, null, token);
  log('GET /audit/logs/TASK/:id (特定对象日志)', auditTask);

  // ---- 7. 通知 API ----
  console.log('\n=== 7. 通知 API ===');

  const notif = await req('GET', '/api/notifications', null, token);
  log('GET /notifications (列表)', notif);

  const notifUnread = await req('GET', '/api/notifications?unread=true', null, token);
  log('GET /notifications?unread=true (未读筛选)', notifUnread);

  const notifCount = await req('GET', '/api/notifications/count', null, token);
  log('GET /notifications/count (通知计数)', notifCount);
  console.log('  counts:', JSON.stringify(notifCount.body?.data));

  // ---- 8. AI 草稿 API ----
  console.log('\n=== 8. AI 草稿 API ===');

  const aiDraft = await req('POST', '/api/ai/draft', { projectId, kind: 'WEEKLY' }, token);
  log('POST /ai/draft (生成周报草稿)', aiDraft);
  aiDraftId = aiDraft.body?.data?.id || '';
  console.log('  content length:', aiDraft.body?.data?.content?.length || 0);

  const aiConfirm = await req('PUT', `/api/ai/draft/${aiDraftId}/confirm`, null, token);
  log('PUT /ai/draft/:id/confirm (确认草稿)', aiConfirm);

  const aiMeeting = await req('POST', '/api/ai/draft', { projectId, kind: 'MEETING' }, token);
  log('POST /ai/draft (会议纪要)', aiMeeting);

  // ---- 9. 用户 API ----
  console.log('\n=== 9. 用户 API ===');

  const userList = await req('GET', '/api/users', null, token);
  log('GET /users (列表)', userList);

  const userDetail = await req('GET', '/api/users/u-001', null, token);
  log('GET /users/:id (详情)', userDetail);

  // ---- 10. 健康检查 ----
  console.log('\n=== 10. 健康检查 ===');
  const health = await req('GET', '/api/health');
  log('GET /health (健康检查)', health);
  console.log('  X-Request-Id:', health.headers?.['x-request-id']);

  // ---- 11. 404 测试 ----
  console.log('\n=== 11. 404 测试 ===');
  const notFound = await req('GET', '/api/nonexistent', null, token);
  log('GET /api/nonexistent (404)', notFound, true);

  // ---- 12. 项目归档 ----
  console.log('\n=== 12. 项目归档 ===');

  const archive = await req('DELETE', `/api/projects/${projectId}`, null, token);
  log('DELETE /projects/:id (归档项目)', archive);

  const projectsAfter = await req('GET', '/api/projects?includeArchived=true', null, token);
  log('GET /projects?includeArchived=true (含归档)', projectsAfter);

  // ---- 汇总 ----
  console.log('\n========== 测试结果汇总 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`总计: ${results.length} 项`);
  console.log(`通过: ${passed} 项 ✅`);
  console.log(`失败: ${failed} 项 ❌`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ❌ ${r.name} (${r.status})`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
