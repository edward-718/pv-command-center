const https = require('https');

const token = process.argv[2] || 'ad473eb0a582e0695b3bb1ed608601f7';

const options = {
  hostname: 'gitee.com',
  path: '/api/v5/user?access_token=' + token,
  method: 'GET',
  headers: {
    'User-Agent': 'PV-Zhishu-Deploy',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('用户名: ' + json.login);
      console.log('邮箱: ' + json.email);
      console.log('ID: ' + json.id);
    } catch (e) {
      console.error('解析失败: ' + e.message);
      console.error('原始响应: ' + data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败: ' + e.message);
});

req.end();