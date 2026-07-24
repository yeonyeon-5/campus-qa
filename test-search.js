// ============================================================
// campus-qa 搜索功能检查脚本
// 正常情况：输入感兴趣的内容的关键词 → 搜索出相应主题的贴子
// 运行方式：node test-search.js
// ============================================================

const http = require('http');
const { execSync, spawn } = require('child_process');

const BASE = 'http://localhost:3099';
const RESULTS = [];
let serverProcess = null;

// ---- 工具函数 ----
function request(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const cookie = opts.sessionCookie || '';
    const postData = opts.body ? new URLSearchParams(opts.body).toString() : null;

    const headers = { Cookie: cookie };
    if (postData) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
    const req = http.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'] || [];
        const newCookie = setCookie.length > 0
          ? setCookie.map(c => c.split(';')[0]).join('; ')
          : cookie;
        resolve({ status: res.statusCode, headers: res.headers, body: data, cookie: newCookie });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function record(category, name, pass, detail) {
  RESULTS.push({ category, name, pass, detail });
  const icon = pass ? '✓' : '✗';
  console.log(`  ${icon} [${category}] ${name}${detail ? ' — ' + detail : ''}`);
}

// ---- 启动服务器 ----
async function startServer() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, { PORT: '3099' });
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) { reject(new Error('服务器启动超时')); }
    }, 15000);
    serverProcess.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('已启动')) {
        started = true;
        clearTimeout(timeout);
        setTimeout(resolve, 500); // 再等半秒确保就绪
      }
    });
    serverProcess.on('error', reject);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ---- 测试用例 ----
async function runTests() {
  // ===== 正常情况（用户核心场景） =====
  console.log('\n--- 正常情况 ---');

  // 先登录获取 cookie
  const loginRes = await request('POST', '/login/guest', {});
  const cookie = loginRes.cookie;

  // 测试1：搜索「食堂」，应返回相关帖子
  {
    const res = await request('GET', '/?q=食堂', { sessionCookie: cookie });
    const hasResult = res.body.includes('求推荐食堂好吃的窗口');
    const notEmpty = !res.body.includes('没有找到相关帖子');
    record('正常', '搜索「食堂」返回相关帖子', hasResult && notEmpty,
      hasResult ? '找到「求推荐食堂好吃的窗口」' : '未找到预期帖子');
  }

  // 测试2：搜索「英语」，应返回英语四级帖子
  {
    const res = await request('GET', '/?q=英语', { sessionCookie: cookie });
    const hasResult = res.body.includes('有没有一起学英语四级的');
    record('正常', '搜索「英语」返回英语四级帖', hasResult,
      hasResult ? '找到目标帖' : '未找到');
  }

  // 测试3：搜索「图书馆」，应返回图书馆帖
  {
    const res = await request('GET', '/?q=图书馆', { sessionCookie: cookie });
    const hasResult = res.body.includes('图书馆哪个楼层最安静');
    record('正常', '搜索「图书馆」返回安静楼层帖', hasResult,
      hasResult ? '找到目标帖' : '未找到');
  }

  // 测试4：搜索「高数」，匹配标题
  {
    const res = await request('GET', '/?q=高数', { sessionCookie: cookie });
    const hasResult = res.body.includes('高数挂了怎么办');
    record('正常', '搜索「高数」匹配标题', hasResult,
      hasResult ? '标题匹配成功' : '未找到');
  }

  // 测试5：搜索内容中的词（不在标题中），匹配正文
  {
    const res = await request('GET', '/?q=麻辣烫', { sessionCookie: cookie });
    const hasResult = res.body.includes('求推荐食堂好吃的窗口');
    record('正常', '搜索「麻辣烫」匹配正文内容', hasResult,
      hasResult ? '正文匹配成功' : '未找到');
  }

  // ===== 空输入 =====
  console.log('\n--- 空输入 ---');

  // 测试6：无 q 参数，应显示所有帖子
  {
    const res = await request('GET', '/', { sessionCookie: cookie });
    const showsHero = res.body.includes('有问题') && res.body.includes('大家一起答');
    const hasPosts = res.body.includes('高数挂了怎么办') && res.body.includes('有没有一起学英语四级的');
    record('空输入', '无搜索词显示首页全部帖子', showsHero && hasPosts,
      showsHero && hasPosts ? '正常显示所有帖子' : `hero=${showsHero} posts=${hasPosts}`);
  }

  // 测试7：q 为空字符串
  {
    const res = await request('GET', '/?q=', { sessionCookie: cookie });
    const showsHero = res.body.includes('有问题') && res.body.includes('大家一起答');
    record('空输入', 'q=空字符串显示全部帖子', showsHero,
      showsHero ? '正常回退到首页' : '异常');
  }

  // 测试8：q 只有空格
  {
    const res = await request('GET', '/?q=+++', { sessionCookie: cookie });
    const showsHero = res.body.includes('有问题') && res.body.includes('大家一起答');
    record('空输入', 'q=纯空格显示全部帖子', showsHero,
      showsHero ? 'trim 后正确回退' : '空格未被 trim');
  }

  // 测试9：Suggest API 空输入
  {
    const res = await request('GET', '/api/suggest', { sessionCookie: cookie });
    const data = JSON.parse(res.body);
    record('空输入', 'Suggest API 无参返回空数组', Array.isArray(data) && data.length === 0,
      `返回 ${data.length} 条`);
  }

  // 测试10：Suggest API q 为空
  {
    const res = await request('GET', '/api/suggest?q=', { sessionCookie: cookie });
    const data = JSON.parse(res.body);
    record('空输入', 'Suggest API q=空返回空数组', Array.isArray(data) && data.length === 0,
      `返回 ${data.length} 条`);
  }

  // ===== 错误输入 & 边界 =====
  console.log('\n--- 边界情况 ---');

  // 测试11：搜索不存在的词
  {
    const res = await request('GET', '/?q=火星文xyz啥也没有', { sessionCookie: cookie });
    const showsEmpty = res.body.includes('没有找到相关帖子') || res.body.includes('换个关键词试试');
    record('边界', '搜索无匹配词显示空状态', showsEmpty,
      showsEmpty ? '正确显示空状态' : '未显示空状态提示');
  }

  // 测试12：单字符搜索
  {
    const res = await request('GET', '/?q=的', { sessionCookie: cookie });
    // 单字符应该不会崩溃，结果可能为空或有
    const notCrash = res.status === 200;
    record('边界', '单字符搜索不崩溃', notCrash,
      notCrash ? `status ${res.status}` : `崩溃 status ${res.status}`);
  }

  // 测试13：特殊字符搜索（XSS 防护）
  {
    const res = await request('GET', '/?q=' + encodeURIComponent('<script>'), { sessionCookie: cookie });
    const notCrash = res.status === 200;
    // 用户输入应被 EJS <%= %> 转义，不应出现 value="<script>" 这种原始注入
    const safelyEscaped = !res.body.includes('"<script>"') && !res.body.includes('><script>');
    const hasEscaped = res.body.includes('&lt;script&gt;');
    record('边界', '搜索特殊字符不崩溃且输入被转义', notCrash && safelyEscaped,
      hasEscaped ? '已安全转义' : '未找到转义痕迹');
  }

  // 测试14：URL 编码的中文搜索
  {
    const res = await request('GET', '/?q=' + encodeURIComponent('选课'), { sessionCookie: cookie });
    const hasResult = res.body.includes('选课系统又崩了');
    record('边界', 'URL 编码中文搜索正常', hasResult,
      hasResult ? '找到目标帖' : '未找到');
  }

  // 测试15：极长搜索词
  {
    const longQuery = '测试'.repeat(500); // 1000 个字符
    const res = await request('GET', '/?q=' + encodeURIComponent(longQuery), { sessionCookie: cookie });
    const notCrash = res.status === 200;
    record('边界', '500 字搜索词不崩溃', notCrash,
      notCrash ? `status ${res.status}` : `崩溃 status ${res.status}`);
  }

  // 测试16：大小写（中文不涉及，但英文关键词可测）
  {
    // 当前数据没有英文，但可以测搜索引擎本身不崩溃
    const res = await request('GET', '/?q=Campus', { sessionCookie: cookie });
    const notCrash = res.status === 200;
    record('边界', '英文搜索不崩溃', notCrash,
      notCrash ? '正常' : '崩溃');
  }

  // 测试17：Suggest API 正常搜索
  {
    const res = await request('GET', '/api/suggest?q=食堂', { sessionCookie: cookie });
    const data = JSON.parse(res.body);
    const found = data.some(p => p.title === '求推荐食堂好吃的窗口');
    record('边界', 'Suggest API 返回建议列表', found && data.length <= 5,
      `返回 ${data.length} 条（限制 5 条）`);
  }

  // 测试18：搜索含数字的关键词
  {
    const res = await request('GET', '/?q=四级', { sessionCookie: cookie });
    const hasResult = res.body.includes('英语');
    record('边界', '搜索「四级」跨帖匹配', hasResult,
      hasResult ? '找到相关帖' : '未找到');
  }

  // ===== 错误输入 =====
  console.log('\n--- 错误输入 ---');

  // 测试19：非法 URL 参数
  {
    const res = await request('GET', '/?q=%FF%GG', { sessionCookie: cookie });
    // 只要不 500 就算通过
    record('错误', '非法 URL 编码不 500', res.status !== 500,
      `status ${res.status}`);
  }

  // 测试20：POST 方式访问搜索页
  {
    const res = await request('POST', '/?q=test', { sessionCookie: cookie, body: {} });
    // GET 路由不会匹配 POST，会 404 或被 express 处理
    const ok = res.status < 500;
    record('错误', 'POST 搜索页不 500', ok,
      `status ${res.status}`);
  }
}

// ---- 主流程 ----
async function main() {
  console.log('========================================');
  console.log(' campus-qa 搜索功能检查');
  console.log(' 分支：实验-v1.1（基于 v1.0）');
  console.log('========================================');

  // 启动服务器
  console.log('\n启动服务器...');
  try {
    await startServer();
  } catch (e) {
    console.error('服务器启动失败：' + e.message);
    process.exit(1);
  }

  try {
    await runTests();
  } catch (e) {
    console.error('\n测试执行错误：' + e.message);
    console.error(e.stack);
  } finally {
    stopServer();
  }

  // 汇总
  const passed = RESULTS.filter(r => r.pass).length;
  const total = RESULTS.length;
  console.log('\n========================================');
  console.log(` 结果：${passed}/${total} 通过`);
  if (passed < total) {
    console.log(' 失败项：');
    RESULTS.filter(r => !r.pass).forEach(r => {
      console.log(`   ✗ [${r.category}] ${r.name}`);
    });
  }
  console.log('========================================');

  // 返回退出码
  process.exit(passed === total ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  stopServer();
  process.exit(1);
});
