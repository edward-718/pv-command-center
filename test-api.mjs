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

let token = '';
let projectId = '';
let taskId = '';

async function test() {
  const results = [];
  const log = (name, r) => {
    results.push({ name, status: r.status, ok: r.status < 400 });
    console.log(`[${r.status < 400 ? 'PASS' : 'FAIL'}] ${name} (${r.status})`);
    if (r.status >= 400) console.log('  →', JSON.stringify(r.body).slice(0, 200));
  };

  console.log('=== Loop 1: 认证 API ===');
  const login = await req('POST', '/api/auth/login', { email: 'lin.wq@pharma.com' });
  token = login.body?.data?.token || '';
  log('POST /auth/login', login);
  console.log('  token length:', token.length);

  const me = await req('GET', '/api/auth/me', null, token);
  log('GET /auth/me', me);

  const users = await req('GET', '/api/auth/users', null, token);
  log('GET /auth/users', users);

  console.log('\n=== Loop 2: 项目 API ===');
  const projects = await req('GET', '/api/projects', null, token);
  log('GET /projects', projects);
  projectId = projects.body?.data?.[0]?.id || '';
  console.log('  first project:', projectId);

  const newProj = await req('POST', '/api/projects', {
    name: '测试项目-' + Date.now(),
    code: 'TEST-' + Date.now().toString().slice(-6),
    templateId: 'tpl-icsr',
    type: 'ICSR',
    product: '测试药品',
  }, token);
  log('POST /projects (create)', newProj);
  const newProjectId = newProj.body?.data?.id;

  if (newProjectId) {
    const upd = await req('PUT', `/api/projects/${newProjectId}`, { description: '测试更新' }, token);
    log('PUT /projects/:id (update)', upd);

    const statusUpd = await req('PUT', `/api/projects/${newProjectId}/status`, { status: 'ACTIVE' }, token);
    log('PUT /projects/:id/status', statusUpd);
  }

  console.log('\n=== Loop 3: 任务 API ===');
  if (projectId) {
    const newTask = await req('POST', '/api/tasks', {
      projectId,
      title: '测试任务',
      description: '测试任务描述',
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'P2',
      riskLevel: 'MEDIUM',
      requiredEvidence: ['原始报告表', '患者基本信息'],
    }, token);
    log('POST /tasks (create)', newTask);
    taskId = newTask.body?.data?.id;

    if (taskId) {
      const detail = await req('GET', `/api/tasks/${taskId}`, null, token);
      log('GET /tasks/:id (detail)', detail);

      // 测试状态流转 - 先到 IN_PROGRESS
      const s1 = await req('PATCH', `/api/tasks/${taskId}/status`, { status: 'IN_PROGRESS' }, token);
      log('PATCH status: NOT_STARTED → IN_PROGRESS', s1);

      // 测试提交复核 - 应该因为证据不完整被拒绝
      const s2 = await req('PATCH', `/api/tasks/${taskId}/status`, {
        status: 'IN_REVIEW',
        submitNote: '提交复核，证据未上传',
      }, token);
      log('PATCH status: IN_PROGRESS → IN_REVIEW (证据校验)', s2);
      console.log('  证据校验结果:', s2.body?.missingEvidence || s2.body?.message);
    }
  }

  const taskList = await req('GET', '/api/tasks?page=1&pageSize=10', null, token);
  log('GET /tasks (list)', taskList);

  console.log('\n=== Loop 4: 驾驶舱 API ===');
  const dash = await req('GET', '/api/dashboard', null, token);
  log('GET /dashboard', dash);

  const kpis = await req('GET', '/api/dashboard/kpis', null, token);
  log('GET /dashboard/kpis', kpis);

  console.log('\n=== Loop 5: 模板 API ===');
  const tpls = await req('GET', '/api/templates', null, token);
  log('GET /templates', tpls);

  const tplDetail = await req('GET', '/api/templates/tpl-icsr', null, token);
  log('GET /templates/:id', tplDetail);

  console.log('\n=== Loop 6: 审计/通知/AI ===');
  const audit = await req('GET', '/api/audit/logs?page=1&pageSize=10', null, token);
  log('GET /audit/logs', audit);

  const notif = await req('GET', '/api/notifications', null, token);
  log('GET /notifications', notif);

  const drafts = await req('GET', '/api/ai/drafts', null, token);
  log('GET /ai/drafts', drafts);

  if (projectId) {
    const aiDraft = await req('POST', '/api/ai/draft', {
      projectId,
      type: 'WEEKLY',
      content: '测试周报草稿',
    }, token);
    log('POST /ai/draft (weekly)', aiDraft);
  }

  console.log('\n========== 测试结果汇总 ==========');
  const passed = results.filter(r => r.ok).length;
  console.log(`通过: ${passed}/${results.length}`);
  results.filter(r => !r.ok).forEach(r => {
    console.log(`  FAIL: ${r.name}`);
  });

  process.exit(0);
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});