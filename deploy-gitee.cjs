// Gitee 自动部署脚本 —— 不需要安装 Git
// 用法: node deploy-gitee.js <你的gitee用户名> <你的gitee私人令牌>
// 私人令牌获取: https://gitee.com/profile/personal_access_tokens -> 生成新令牌 -> 勾选 projects, user_info, pull_requests

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITEE_API = 'gitee.com';

// ===== 参数 =====
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node deploy-gitee.js <你的gitee用户名> <你的gitee私人令牌>');
  console.error('令牌获取: https://gitee.com/profile/personal_access_tokens');
  process.exit(1);
}
const GITEE_USERNAME = args[0];
const GITEE_TOKEN = args[1];
const REPO_NAME = 'pv-command-center';

// ===== HTTP 请求封装 =====
function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, data: json, raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: {}, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function api(method, pathname, data = null) {
  const postData = data ? JSON.stringify(data) : null;
  const queryStr = method === 'GET' && data
    ? '?' + Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const options = {
    hostname: GITEE_API,
    path: `/api/v5${pathname}${queryStr}`,
    method,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'PV-Zhishu-Deploy',
      ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
    },
  };
  return httpsRequest(options, postData);
}

// ===== 递归遍历文件 =====
function walkDir(dir, baseDir = dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name === '.git' || item.name.startsWith('.')) continue;
      results.push(...walkDir(fullPath, baseDir));
    } else {
      results.push({ fullPath, relPath, size: fs.statSync(fullPath).size });
    }
  }
  return results;
}

// ===== 检查仓库是否存在 =====
async function repoExists() {
  const res = await api('GET', `/repos/${GITEE_USERNAME}/${REPO_NAME}`);
  return res.statusCode === 200;
}

// ===== 创建仓库 =====
async function createRepo() {
  console.log('→ 创建仓库: ' + REPO_NAME);
  const res = await api('POST', '/user/repos', {
    access_token: GITEE_TOKEN,
    name: REPO_NAME,
    description: 'PV智枢 · 药物警戒项目管理中心',
    private: false,
    has_issues: true,
    has_wiki: true,
    can_comment: true,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log('  ✓ 仓库创建成功: https://gitee.com/' + GITEE_USERNAME + '/' + REPO_NAME);
    return true;
  }
  console.log('  ! 状态码: ' + res.statusCode + ' -> ' + (res.data.message || res.raw));
  return res.statusCode === 400 && (res.data.message || '').includes('已存在');
}

// ===== 上传单个文件 =====
async function uploadFile(relPath, fullPath) {
  try {
    const content = fs.readFileSync(fullPath);
    const isBinary = content.includes(0) || /\.(png|jpg|jpeg|gif|svg|woff2|woff|ttf|eot|ico)$/i.test(fullPath);
    const b64 = content.toString('base64');
    const res = await api('POST', `/repos/${GITEE_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}`, {
      access_token: GITEE_TOKEN,
      content: b64,
      message: '部署: ' + relPath,
      branch: 'master',
    });
    if (res.statusCode >= 200 && res.statusCode < 300) return true;
    // 文件已存在: 更新它
    if (res.statusCode === 400) {
      const res2 = await api('GET', `/repos/${GITEE_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}`, {
        access_token: GITEE_TOKEN,
        ref: 'master',
      });
      if (res2.statusCode === 200 && res2.data.sha) {
        const res3 = await api('PUT', `/repos/${GITEE_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}`, {
          access_token: GITEE_TOKEN,
          content: b64,
          message: '更新: ' + relPath,
          branch: 'master',
          sha: res2.data.sha,
        });
        return res3.statusCode >= 200 && res3.statusCode < 300;
      }
    }
    console.log('  ✗ 上传失败 [' + relPath + ']: HTTP ' + res.statusCode);
    return false;
  } catch (e) {
    console.log('  ✗ 上传错误 [' + relPath + ']: ' + e.message);
    return false;
  }
}

// ===== 主函数 =====
async function main() {
  console.log('========================================');
  console.log('  PV智枢 · Gitee 自动部署');
  console.log('========================================\n');

  // 1. 确保仓库存在
  const exists = await repoExists();
  if (!exists) {
    const ok = await createRepo();
    if (!ok) {
      console.error('仓库创建失败，请检查令牌是否有效。');
      console.error('令牌获取: https://gitee.com/profile/personal_access_tokens');
      process.exit(1);
    }
  } else {
    console.log('→ 仓库已存在: https://gitee.com/' + GITEE_USERNAME + '/' + REPO_NAME);
  }

  // 2. 收集要上传的文件（源码 + dist）
  console.log('\n→ 扫描项目文件...');
  const root = __dirname;
  const allFiles = walkDir(root, root);
  // 过滤掉 node_modules, dist 从其他位置补充, .git 等已在 walkDir 排除
  const sourceFiles = allFiles.filter(f => {
    // 排除一些大的/敏感文件
    if (f.relPath.startsWith('dist/')) return false; // dist 单独处理
    return true;
  });

  console.log('  发现 ' + sourceFiles.length + ' 个源码文件');

  // 3. 先上传源码 + README
  console.log('\n→ 上传源码文件（' + sourceFiles.length + ' 个）...');
  let successCount = 0;
  for (let i = 0; i < sourceFiles.length; i++) {
    const f = sourceFiles[i];
    if (f.size > 10 * 1024 * 1024) {
      console.log('  跳过 (>' + Math.round(f.size / 1024) + 'KB): ' + f.relPath);
      continue;
    }
    const ok = await uploadFile(f.relPath, f.fullPath);
    if (ok) {
      successCount++;
      process.stdout.write('  进度: ' + successCount + '/' + sourceFiles.length + '\r');
    }
    // 限速，避免触发 API 限流
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('\n  ✓ 源码上传完成');

  // 4. 上传 dist 目录
  console.log('\n→ 扫描 dist 目录...');
  const distDir = path.join(root, 'dist');
  const distFiles = walkDir(distDir, distDir);
  console.log('  发现 ' + distFiles.length + ' 个部署文件');

  console.log('\n→ 上传 dist 目录...');
  let distCount = 0;
  for (let i = 0; i < distFiles.length; i++) {
    const f = distFiles[i];
    const ok = await uploadFile('dist/' + f.relPath, f.fullPath);
    if (ok) {
      distCount++;
      process.stdout.write('  进度: ' + distCount + '/' + distFiles.length + '\r');
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('\n  ✓ dist 上传完成');

  // 5. 部署提示
  console.log('\n========================================');
  console.log('  ✓ 全部上传成功！');
  console.log('========================================');
  console.log('\n仓库:  https://gitee.com/' + GITEE_USERNAME + '/' + REPO_NAME);
  console.log('\n📌 接下来你需要手动开启 Gitee Pages：');
  console.log('   1. 打开: https://gitee.com/' + GITEE_USERNAME + '/' + REPO_NAME + '/pages');
  console.log('   2. 部署目录填: dist');
  console.log('   3. 勾选「使用 HTTPS」');
  console.log('   4. 点击「启动」');
  console.log('   5. 等 1-2 分钟，得到形如:');
  console.log('      https://' + GITEE_USERNAME + '.gitee.io/' + REPO_NAME);
  console.log('\n========================================');
}

main().catch((e) => {
  console.error('\n✗ 部署出错: ' + e.message);
  process.exit(1);
});
