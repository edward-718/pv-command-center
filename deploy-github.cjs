const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_API = 'api.github.com';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node deploy-github.cjs <github-username> <github-token>');
  process.exit(1);
}
const GITHUB_USERNAME = args[0];
const GITHUB_TOKEN = args[1];
const REPO_NAME = 'pv-command-center';
const BRANCH = 'main';

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
  const options = {
    hostname: GITHUB_API,
    path: pathname,
    method,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'PV-Command-Center-Deploy',
      'Authorization': 'token ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
    },
  };
  return httpsRequest(options, postData);
}

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

async function repoExists() {
  const res = await api('GET', `/repos/${GITHUB_USERNAME}/${REPO_NAME}`);
  return res.statusCode === 200;
}

async function createRepo() {
  console.log('-> Creating repo: ' + REPO_NAME);
  const res = await api('POST', '/user/repos', {
    name: REPO_NAME,
    description: 'PV Command Center - Pharmacovigilance Project Management',
    private: false,
    has_issues: true,
    has_wiki: true,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log('  OK Repo created: https://github.com/' + GITHUB_USERNAME + '/' + REPO_NAME);
    return true;
  }
  console.log('  Status: ' + res.statusCode + ' -> ' + (res.data.message || res.raw));
  return false;
}

async function uploadFile(relPath, fullPath) {
  try {
    const content = fs.readFileSync(fullPath);
    const b64 = content.toString('base64');

    const getRes = await api('GET', `/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}?ref=${BRANCH}`);

    if (getRes.statusCode === 200 && getRes.data.sha) {
      const putRes = await api('PUT', `/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}`, {
        message: 'Update: ' + relPath,
        content: b64,
        branch: BRANCH,
        sha: getRes.data.sha,
      });
      return putRes.statusCode >= 200 && putRes.statusCode < 300;
    } else {
      const putRes = await api('PUT', `/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${encodeURIComponent(relPath)}`, {
        message: 'Add: ' + relPath,
        content: b64,
        branch: BRANCH,
      });
      if (putRes.statusCode >= 200 && putRes.statusCode < 300) return true;
      console.log('  FAIL [' + relPath + ']: HTTP ' + putRes.statusCode + ' ' + (putRes.data.message || ''));
      return false;
    }
  } catch (e) {
    console.log('  ERROR [' + relPath + ']: ' + e.message);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('  PV Command Center - GitHub Deploy');
  console.log('========================================\n');

  const exists = await repoExists();
  if (!exists) {
    const ok = await createRepo();
    if (!ok) {
      console.error('Failed to create repo. Check token permissions.');
      process.exit(1);
    }
  } else {
    console.log('-> Repo exists: https://github.com/' + GITHUB_USERNAME + '/' + REPO_NAME);
  }

  console.log('\n-> Scanning project files...');
  const root = __dirname;
  const allFiles = walkDir(root, root);
  const sourceFiles = allFiles.filter(f => {
    if (f.relPath.startsWith('dist/')) return false;
    return true;
  });

  console.log('  Found ' + sourceFiles.length + ' source files');

  console.log('\n-> Uploading source files (' + sourceFiles.length + ' files)...');
  let successCount = 0;
  for (let i = 0; i < sourceFiles.length; i++) {
    const f = sourceFiles[i];
    if (f.size > 10 * 1024 * 1024) {
      console.log('  Skip (>' + Math.round(f.size / 1024) + 'KB): ' + f.relPath);
      continue;
    }
    const ok = await uploadFile(f.relPath, f.fullPath);
    if (ok) {
      successCount++;
      process.stdout.write('  Progress: ' + successCount + '/' + sourceFiles.length + '\r');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n  Source upload done');

  const distDir = path.join(root, 'dist');
  if (fs.existsSync(distDir)) {
    console.log('\n-> Scanning dist directory...');
    const distFiles = walkDir(distDir, distDir);
    console.log('  Found ' + distFiles.length + ' dist files');

    console.log('\n-> Uploading dist directory...');
    let distCount = 0;
    for (let i = 0; i < distFiles.length; i++) {
      const f = distFiles[i];
      const ok = await uploadFile('dist/' + f.relPath, f.fullPath);
      if (ok) {
        distCount++;
        process.stdout.write('  Progress: ' + distCount + '/' + distFiles.length + '\r');
      }
      await new Promise(r => setTimeout(r, 300));
    }
    console.log('\n  Dist upload done');
  }

  console.log('\n========================================');
  console.log('  All done!');
  console.log('========================================');
  console.log('\nRepo: https://github.com/' + GITHUB_USERNAME + '/' + REPO_NAME);
  console.log('\n========================================');
}

main().catch((e) => {
  console.error('\nERROR: ' + e.message);
  process.exit(1);
});
