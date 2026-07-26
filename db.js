const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json');
const MSGS_FILE = path.join(DATA_DIR, 'messages.json');
const BM_FILE = path.join(DATA_DIR, 'bookmarks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ANN_FILE = path.join(DATA_DIR, 'announcements.json');
const REPORT_FILE = path.join(DATA_DIR, 'reports.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const ARTICLE_COMMENTS_FILE = path.join(DATA_DIR, 'article_comments.json');

// 确保数据目录和文件存在
function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(POSTS_FILE)) {
    fs.writeFileSync(POSTS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(REPLIES_FILE)) {
    fs.writeFileSync(REPLIES_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(MSGS_FILE)) {
    fs.writeFileSync(MSGS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(BM_FILE)) {
    fs.writeFileSync(BM_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '{}', 'utf-8');
  }
  if (!fs.existsSync(ANN_FILE)) {
    fs.writeFileSync(ANN_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(REPORT_FILE)) {
    fs.writeFileSync(REPORT_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(ARTICLES_FILE)) {
    fs.writeFileSync(ARTICLES_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(ARTICLE_COMMENTS_FILE)) {
    fs.writeFileSync(ARTICLE_COMMENTS_FILE, '[]', 'utf-8');
  }
}

// 去除 BOM 头
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

// 读取所有帖子
function readPosts() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(POSTS_FILE, 'utf-8')));
}

// 写入所有帖子（不带 BOM）
function writePosts(posts) {
  init();
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), { encoding: 'utf-8' });
}

// 读取所有回复
function readReplies() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(REPLIES_FILE, 'utf-8')));
}

// 写入所有回复（不带 BOM）
function writeReplies(replies) {
  init();
  fs.writeFileSync(REPLIES_FILE, JSON.stringify(replies, null, 2), { encoding: 'utf-8' });
}

// 生成 ID
function nextId(items) {
  if (items.length === 0) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}

// 格式化时间
function now() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ===== 帖子相关 =====

function getVisiblePosts() {
  const posts = readPosts();
  const replies = readReplies();
  return posts
    .filter(p => !p.is_hidden)
    .map(p => ({
      ...p,
      reply_count: replies.filter(r => r.post_id === p.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

function getPostById(id) {
  return readPosts().find(p => p.id === Number(id)) || null;
}

function getRepliesByPostId(postId) {
  return readReplies()
    .filter(r => r.post_id === Number(postId))
    .sort((a, b) => a.id - b.id);
}

function createPost(title, content, author) {
  const posts = readPosts();
  const post = {
    id: nextId(posts),
    title,
    content,
    author: author || '匿名',
    is_hidden: true,
    status: 'pending',
    likes: [],
    created_at: now()
  };
  posts.push(post);
  writePosts(posts);
  return post.id;
}

function approvePost(id) {
  const posts = readPosts();
  const post = posts.find(p => p.id === Number(id));
  if (!post) return null;
  post.is_hidden = false;
  post.status = 'approved';
  writePosts(posts);
  return true;
}

function rejectPost(id, reason) {
  const posts = readPosts();
  const post = posts.find(p => p.id === Number(id));
  if (!post) return null;
  post.is_hidden = true;
  post.status = 'rejected';
  post.reject_reason = reason || '';
  writePosts(posts);
  return true;
}

function getPendingPosts() {
  const posts = readPosts();
  const replies = readReplies();
  return posts
    .filter(p => p.status === 'pending')
    .map(p => ({
      ...p,
      reply_count: replies.filter(r => r.post_id === p.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

// 计算帖子热度（点赞×1 + 回复×2 + 收藏×3）
function getPostsWithHeat() {
  const posts = readPosts();
  const replies = readReplies();
  const bookmarks = readBookmarks();
  return posts
    .map(p => {
      const likeCount = (p.likes || []).length;
      const replyCount = replies.filter(r => r.post_id === p.id).length;
      const bookmarkCount = bookmarks.filter(b => b.post_id === p.id).length;
      return {
        ...p,
        like_count: likeCount,
        reply_count: replyCount,
        bookmark_count: bookmarkCount,
        heat: likeCount * 1 + replyCount * 2 + bookmarkCount * 3
      };
    })
    .sort((a, b) => b.heat - a.heat);
}

function createReply(postId, content, author) {
  const replies = readReplies();
  const reply = {
    id: nextId(replies),
    post_id: Number(postId),
    content,
    author: author || '匿名',
    likes: [],
    created_at: now()
  };
  replies.push(reply);
  writeReplies(replies);
  return reply.id;
}

// ===== 管理相关 =====

function getAllPosts() {
  const posts = readPosts();
  const replies = readReplies();
  return posts
    .map(p => ({
      ...p,
      reply_count: replies.filter(r => r.post_id === p.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

function togglePostHidden(id) {
  const posts = readPosts();
  const post = posts.find(p => p.id === Number(id));
  if (!post) return null;
  post.is_hidden = !post.is_hidden;
  writePosts(posts);
  return post.is_hidden;
}

// ===== 用户相关 =====

function getPostsByAuthor(author) {
  const posts = readPosts();
  const replies = readReplies();
  return posts
    .filter(p => p.author === author)
    .map(p => ({
      ...p,
      reply_count: replies.filter(r => r.post_id === p.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

// 获取某人的所有回复（带帖子标题）
function getRepliesByAuthor(author) {
  const replies = readReplies().filter(r => r.author === author);
  const posts = readPosts();
  return replies.map(r => {
    const post = posts.find(p => p.id === r.post_id);
    return { ...r, post_title: post ? post.title : '(已删除)', post_hidden: post ? post.is_hidden : true };
  }).sort((a, b) => b.id - a.id);
}

// 获取某人帖子的新回复（通知）
function getNotifications(author) {
  const myPosts = readPosts().filter(p => p.author === author);
  const myPostIds = myPosts.map(p => p.id);
  const allReplies = readReplies().filter(r => myPostIds.includes(r.post_id));
  const othersReplies = allReplies.filter(r => r.author !== author);
  return othersReplies
    .map(r => {
      const post = myPosts.find(p => p.id === r.post_id);
      return { ...r, post_title: post ? post.title : '(已删除)' };
    })
    .sort((a, b) => b.id - a.id);
}

// 删除回复
function deleteReply(id, author) {
  const replies = readReplies();
  const idx = replies.findIndex(r => r.id === Number(id) && r.author === author);
  if (idx === -1) return false;
  replies.splice(idx, 1);
  writeReplies(replies);
  return true;
}

// 删除帖子（及关联回复）
function deletePost(id, author) {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === Number(id) && p.author === author);
  if (idx === -1) return false;
  posts.splice(idx, 1);
  writePosts(posts);
  // 同时删除关联回复
  const replies = readReplies().filter(r => r.post_id !== Number(id));
  writeReplies(replies);
  return true;
}

// ===== 私信相关 =====

function readMessages() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(MSGS_FILE, 'utf-8')));
}

function writeMessages(msgs) {
  init();
  fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs, null, 2), { encoding: 'utf-8' });
}

function sendMessage(from, to, content) {
  const msgs = readMessages();
  const msg = { id: nextId(msgs), from, to, content, created_at: now() };
  msgs.push(msg);
  writeMessages(msgs);
  return msg;
}

function getConversation(user1, user2) {
  return readMessages()
    .filter(m => (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1))
    .sort((a, b) => a.id - b.id);
}

function getChatList(user) {
  const msgs = readMessages();
  const partners = new Map();
  msgs.forEach(m => {
    const partner = m.from === user ? m.to : m.to === user ? m.from : null;
    if (!partner || partner === user) return;
    if (!partners.has(partner) || m.id > partners.get(partner).id) {
      partners.set(partner, m);
    }
  });
  return Array.from(partners.entries())
    .map(([name, msg]) => ({ name, lastMsg: msg.content, lastMsgFrom: msg.from, time: msg.created_at }))
    .sort((a, b) => b.time.localeCompare(a.time));
}

// ===== 搜索 =====
function searchPosts(keyword) {
  const kw = keyword.toLowerCase();
  return readPosts()
    .filter(p => !p.is_hidden)
    .filter(p => p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw))
    .map(p => ({ ...p, reply_count: readReplies().filter(r => r.post_id === p.id).length }))
    .sort((a, b) => b.id - a.id);
}

// ===== 点赞 =====
function toggleLikePost(postId, username) {
  const posts = readPosts();
  const post = posts.find(p => p.id === Number(postId));
  if (!post) return null;
  if (!post.likes) post.likes = [];
  const idx = post.likes.indexOf(username);
  if (idx === -1) { post.likes.push(username); }
  else { post.likes.splice(idx, 1); }
  writePosts(posts);
  return { count: post.likes.length, liked: idx === -1 };
}

function toggleLikeReply(replyId, username) {
  const replies = readReplies();
  const reply = replies.find(r => r.id === Number(replyId));
  if (!reply) return null;
  if (!reply.likes) reply.likes = [];
  const idx = reply.likes.indexOf(username);
  if (idx === -1) { reply.likes.push(username); }
  else { reply.likes.splice(idx, 1); }
  writeReplies(replies);
  return { count: reply.likes.length, liked: idx === -1 };
}

// ===== 收藏 =====
function readBookmarks() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(BM_FILE, 'utf-8')));
}
function writeBookmarks(bms) {
  init();
  fs.writeFileSync(BM_FILE, JSON.stringify(bms, null, 2), { encoding: 'utf-8' });
}

function toggleBookmark(username, postId) {
  const bms = readBookmarks();
  const idx = bms.findIndex(b => b.username === username && b.post_id === Number(postId));
  if (idx === -1) {
    bms.push({ id: nextId(bms), username, post_id: Number(postId), created_at: now() });
    writeBookmarks(bms);
    return true;
  } else {
    bms.splice(idx, 1);
    writeBookmarks(bms);
    return false;
  }
}

function isBookmarked(username, postId) {
  return readBookmarks().some(b => b.username === username && b.post_id === Number(postId));
}

function getBookmarkedPosts(username) {
  const bms = readBookmarks().filter(b => b.username === username);
  const posts = readPosts();
  const replies = readReplies();
  return bms.map(b => {
    const p = posts.find(x => x.id === b.post_id);
    if (!p) return null;
    return { ...p, reply_count: replies.filter(r => r.post_id === p.id).length, bookmarked_at: b.created_at };
  }).filter(Boolean).sort((a, b) => b.id - a.id);
}

function getBookmarkCount(postId) {
  return readBookmarks().filter(b => b.post_id === Number(postId)).length;
}

// ===== 用户设置 =====
const crypto = require('crypto');
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}
function readUsers() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(USERS_FILE, 'utf-8')));
}
function writeUsers(users) {
  init();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { encoding: 'utf-8' });
}
function registerUser(username, password, realname, studentId) {
  const users = readUsers();
  if (users[username]) return null; // 已存在
  const salt = crypto.randomBytes(16).toString('hex');
  users[username] = {
    passwordHash: hashPassword(password, salt),
    salt: salt,
    realname: realname || '',
    studentId: studentId || '',
    avatarColor: username.length % 5,
    avatarUrl: null
  };
  writeUsers(users);
  return true;
}
function getUserInfo(username) {
  const users = readUsers();
  const u = users[username];
  if (!u) return null;
  return { realname: u.realname || '', studentId: u.studentId || '' };
}
function verifyLogin(username, password) {
  const users = readUsers();
  const user = users[username];
  if (!user || !user.passwordHash) return false;
  if (user.banned) return 'banned'; // 被封禁
  return hashPassword(password, user.salt) === user.passwordHash;
}
// 检查用户是否被禁言
function isUserMuted(username) {
  const users = readUsers();
  return !!(users[username] && users[username].muted);
}
// 检查用户是否被封禁
function isUserBanned(username) {
  const users = readUsers();
  return !!(users[username] && users[username].banned);
}
// 获取所有用户列表（含统计）
function getAllUsers() {
  const users = readUsers();
  const posts = readPosts();
  const replies = readReplies();
  return Object.keys(users).map(name => {
    const u = users[name];
    return {
      username: name,
      realname: u.realname || '',
      studentId: u.studentId || '',
      muted: !!u.muted,
      banned: !!u.banned,
      dailyLimit: u.dailyLimit || 0,
      avatarColor: u.avatarColor !== undefined ? u.avatarColor : name.length % 5,
      postCount: posts.filter(p => p.author === name).length,
      replyCount: replies.filter(r => r.author === name).length
    };
  }).sort((a, b) => a.username.localeCompare(b.username));
}
// 每日限流
function getUserRateLimit(username) {
  const users = readUsers();
  return (users[username] && users[username].dailyLimit) || 0;
}
function setUserRateLimit(username, limit) {
  const users = readUsers();
  if (!users[username]) return;
  users[username].dailyLimit = Number(limit) || 0;
  writeUsers(users);
}
function getTodayActivityCount(username) {
  const today = new Date();
  const td = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const posts = readPosts().filter(p => p.author === username && (p.created_at || '').startsWith(td)).length;
  const replies = readReplies().filter(r => r.author === username && (r.created_at || '').startsWith(td)).length;
  return posts + replies;
}

// 切换禁言
function toggleMuteUser(username) {
  const users = readUsers();
  if (!users[username]) return null;
  users[username].muted = !users[username].muted;
  writeUsers(users);
  return users[username].muted;
}
// 切换封禁
function toggleBanUser(username) {
  const users = readUsers();
  if (!users[username]) return null;
  users[username].banned = !users[username].banned;
  writeUsers(users);
  return users[username].banned;
}
// 查找超时无人回复的帖子
function getUnansweredPosts(hours) {
  const posts = readPosts();
  const replies = readReplies();
  const cutoff = Date.now() - hours * 3600000;
  return posts.filter(p => {
    if (p.is_hidden) return false;
    const hasReply = replies.some(r => r.post_id === p.id);
    if (hasReply) return false;
    const postTime = new Date(p.created_at).getTime();
    return postTime < cutoff;
  }).sort((a, b) => a.id - b.id);
}

// 确保机器人用户存在
function ensureBotUser() {
  const users = readUsers();
  if (!users['校园助手']) {
    users['校园助手'] = {
      passwordHash: '',
      salt: '',
      realname: 'AI助手',
      studentId: 'BOT001',
      avatarColor: 2,
      avatarUrl: null,
      muted: false,
      banned: false
    };
    writeUsers(users);
  }
}

// 管理员删除任意帖子
function adminDeletePost(id) {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === Number(id));
  if (idx === -1) return false;
  posts.splice(idx, 1);
  writePosts(posts);
  // 同时删除关联回复
  const replies = readReplies().filter(r => r.post_id !== Number(id));
  writeReplies(replies);
  return true;
}
function getAvatarColor(name) {
  const users = readUsers();
  if (users[name] && users[name].avatarColor !== undefined) {
    return users[name].avatarColor;
  }
  return name.length % 5;
}
function setAvatarColor(name, colorIdx) {
  const users = readUsers();
  if (!users[name]) users[name] = {};
  users[name].avatarColor = Number(colorIdx);
  writeUsers(users);
}
function getAvatarUrl(name) {
  const users = readUsers();
  if (users[name] && users[name].avatarUrl) {
    return users[name].avatarUrl;
  }
  return null;
}
function setAvatarUrl(name, url) {
  const users = readUsers();
  if (!users[name]) users[name] = {};
  users[name].avatarUrl = url;
  writeUsers(users);
}

// ===== 公告相关 =====
function readAnnouncements() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(ANN_FILE, 'utf-8')));
}
function writeAnnouncements(items) {
  init();
  fs.writeFileSync(ANN_FILE, JSON.stringify(items, null, 2), { encoding: 'utf-8' });
}
function getAnnouncements() {
  return readAnnouncements().sort((a, b) => b.id - a.id);
}
function createAnnouncement(title, content, author) {
  const items = readAnnouncements();
  const item = { id: nextId(items), title, content, author, created_at: now() };
  items.push(item);
  writeAnnouncements(items);
  return item.id;
}
function deleteAnnouncement(id) {
  const items = readAnnouncements();
  const idx = items.findIndex(a => a.id === Number(id));
  if (idx === -1) return false;
  items.splice(idx, 1);
  writeAnnouncements(items);
  return true;
}

// ===== 举报相关 =====
function readReports() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(REPORT_FILE, 'utf-8')));
}
function writeReports(items) {
  init();
  fs.writeFileSync(REPORT_FILE, JSON.stringify(items, null, 2), { encoding: 'utf-8' });
}
function createReport(type, targetId, targetTitle, category, reason, evidence, reporter) {
  const items = readReports();
  const item = { id: nextId(items), type, target_id: targetId, target_title: targetTitle, category: category || '其他', reason, evidence: evidence || [], reporter, status: 'pending', created_at: now() };
  items.push(item);
  writeReports(items);
  // 自动阈值处理
  const pendingCount = items.filter(r => r.type === type && r.target_id === targetId && r.status === 'pending').length;
  if (type === 'post') {
    if (pendingCount >= 5) {
      // 5次举报：自动删除帖子
      const posts = readPosts();
      const idx = posts.findIndex(p => p.id === Number(targetId));
      if (idx !== -1) { posts.splice(idx, 1); writePosts(posts); }
      // 标记所有相关举报为已处理
      items.forEach(r => { if (r.type === 'post' && r.target_id === targetId && r.status === 'pending') r.status = 'handled'; });
      writeReports(items);
    } else if (pendingCount >= 3) {
      // 3次举报：自动下架
      const posts = readPosts();
      const post = posts.find(p => p.id === Number(targetId));
      if (post && !post.is_hidden) { post.is_hidden = true; post.status = 'hidden'; writePosts(posts); }
    }
  } else if (type === 'user') {
    const users = readUsers();
    if (pendingCount >= 5) {
      // 5次举报：自动封禁
      if (users[targetId]) { users[targetId].banned = true; writeUsers(users); }
      items.forEach(r => { if (r.type === 'user' && r.target_id === targetId && r.status === 'pending') r.status = 'handled'; });
      writeReports(items);
    } else if (pendingCount >= 3) {
      // 3次举报：自动禁言+限流
      if (users[targetId]) { users[targetId].muted = true; users[targetId].dailyLimit = 3; writeUsers(users); }
    }
  }
  return item.id;
}
function getReports() {
  return readReports().sort((a, b) => b.id - a.id);
}
function getPendingReports() {
  return readReports().filter(r => r.status === 'pending').sort((a, b) => b.id - a.id);
}
function getHandledReports() {
  return readReports().filter(r => r.status === 'handled').sort((a, b) => b.id - a.id);
}
function handleReport(id) {
  const items = readReports();
  const item = items.find(r => r.id === Number(id));
  if (!item) return false;
  item.status = 'handled';
  writeReports(items);
  return true;
}
// 获取举报聚合统计（待处理举报按目标分组，可按类别筛选）
function getReportStats(category) {
  let reports = readReports().filter(r => r.status === 'pending');
  if (category) reports = reports.filter(r => r.category === category);
  const map = new Map();
  reports.forEach(r => {
    const key = r.type + ':' + r.target_id;
    if (!map.has(key)) {
      map.set(key, { type: r.type, target_id: r.target_id, target_title: r.target_title, count: 0, reports: [] });
    }
    const entry = map.get(key);
    entry.count++;
    entry.reports.push(r);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
// 一键处理某目标的所有举报
function handleAllReportsForTarget(type, targetId) {
  const items = readReports();
  let changed = false;
  items.forEach(r => {
    if (r.type === type && r.target_id === targetId && r.status === 'pending') {
      r.status = 'handled';
      changed = true;
    }
  });
  if (changed) writeReports(items);
  return changed;
}

// ===== 博客/文献相关 =====
function readArticles() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(ARTICLES_FILE, 'utf-8')));
}
function writeArticles(items) {
  init();
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(items, null, 2), { encoding: 'utf-8' });
}
function readArticleComments() {
  init();
  return JSON.parse(stripBOM(fs.readFileSync(ARTICLE_COMMENTS_FILE, 'utf-8')));
}
function writeArticleComments(items) {
  init();
  fs.writeFileSync(ARTICLE_COMMENTS_FILE, JSON.stringify(items, null, 2), { encoding: 'utf-8' });
}

function getVisibleArticles(category) {
  let articles = readArticles().filter(a => !a.is_hidden && a.status === 'approved');
  if (category && category !== '全部') {
    articles = articles.filter(a => a.category === category);
  }
  const comments = readArticleComments();
  return articles
    .map(a => ({
      ...a,
      comment_count: comments.filter(c => c.article_id === a.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

function getArticleById(id) {
  return readArticles().find(a => a.id === Number(id)) || null;
}

function createArticle(title, content, summary, category, tags, author) {
  const articles = readArticles();
  const article = {
    id: nextId(articles),
    title,
    content,
    summary: summary || content.slice(0, 100),
    author: author || '匿名',
    category: category || '其他',
    tags: tags || [],
    is_hidden: true,
    status: 'pending',
    likes: [],
    views: 0,
    created_at: now()
  };
  articles.push(article);
  writeArticles(articles);
  return article.id;
}

function approveArticle(id) {
  const articles = readArticles();
  const article = articles.find(a => a.id === Number(id));
  if (!article) return null;
  article.is_hidden = false;
  article.status = 'approved';
  writeArticles(articles);
  return true;
}

function rejectArticle(id, reason) {
  const articles = readArticles();
  const article = articles.find(a => a.id === Number(id));
  if (!article) return null;
  article.is_hidden = true;
  article.status = 'rejected';
  article.reject_reason = reason || '';
  writeArticles(articles);
  return true;
}

function toggleArticleHidden(id) {
  const articles = readArticles();
  const article = articles.find(a => a.id === Number(id));
  if (!article) return null;
  article.is_hidden = !article.is_hidden;
  writeArticles(articles);
  return article.is_hidden;
}

function getPendingArticles() {
  return readArticles()
    .filter(a => a.status === 'pending')
    .sort((a, b) => b.id - a.id);
}

function getArticleComments(articleId) {
  return readArticleComments()
    .filter(c => c.article_id === Number(articleId))
    .sort((a, b) => a.id - b.id);
}

function createArticleComment(articleId, content, author) {
  const comments = readArticleComments();
  const comment = {
    id: nextId(comments),
    article_id: Number(articleId),
    content,
    author: author || '匿名',
    likes: [],
    created_at: now()
  };
  comments.push(comment);
  writeArticleComments(comments);
  return comment.id;
}

function toggleLikeArticle(articleId, username) {
  const articles = readArticles();
  const article = articles.find(a => a.id === Number(articleId));
  if (!article) return null;
  if (!article.likes) article.likes = [];
  const idx = article.likes.indexOf(username);
  if (idx === -1) { article.likes.push(username); }
  else { article.likes.splice(idx, 1); }
  writeArticles(articles);
  return { count: article.likes.length, liked: idx === -1 };
}

function toggleLikeArticleComment(commentId, username) {
  const comments = readArticleComments();
  const comment = comments.find(c => c.id === Number(commentId));
  if (!comment) return null;
  if (!comment.likes) comment.likes = [];
  const idx = comment.likes.indexOf(username);
  if (idx === -1) { comment.likes.push(username); }
  else { comment.likes.splice(idx, 1); }
  writeArticleComments(comments);
  return { count: comment.likes.length, liked: idx === -1 };
}

function incrementArticleViews(id) {
  const articles = readArticles();
  const article = articles.find(a => a.id === Number(id));
  if (!article) return;
  article.views = (article.views || 0) + 1;
  writeArticles(articles);
}

function getArticlesByAuthor(author) {
  const comments = readArticleComments();
  return readArticles()
    .filter(a => a.author === author)
    .map(a => ({
      ...a,
      comment_count: comments.filter(c => c.article_id === a.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

function searchArticles(keyword) {
  const kw = keyword.toLowerCase();
  const comments = readArticleComments();
  return readArticles()
    .filter(a => !a.is_hidden && a.status === 'approved')
    .filter(a => a.title.toLowerCase().includes(kw) || a.content.toLowerCase().includes(kw) || (a.summary || '').toLowerCase().includes(kw))
    .map(a => ({
      ...a,
      comment_count: comments.filter(c => c.article_id === a.id).length
    }))
    .sort((a, b) => b.id - a.id);
}

function adminDeleteArticle(id) {
  const articles = readArticles();
  const idx = articles.findIndex(a => a.id === Number(id));
  if (idx === -1) return false;
  articles.splice(idx, 1);
  writeArticles(articles);
  const comments = readArticleComments().filter(c => c.article_id !== Number(id));
  writeArticleComments(comments);
  return true;
}

module.exports = {
  getVisiblePosts,
  getPostById,
  getRepliesByPostId,
  createPost,
  createReply,
  getAllPosts,
  togglePostHidden,
  approvePost,
  rejectPost,
  getPendingPosts,
  getPostsWithHeat,
  getPostsByAuthor,
  getRepliesByAuthor,
  getNotifications,
  deleteReply,
  deletePost,
  sendMessage,
  getConversation,
  getChatList,
  searchPosts,
  toggleLikePost,
  toggleLikeReply,
  toggleBookmark,
  isBookmarked,
  getBookmarkedPosts,
  getBookmarkCount,
  getAvatarColor,
  setAvatarColor,
  getAvatarUrl,
  setAvatarUrl,
  registerUser,
  verifyLogin,
  getUserInfo,
  isUserMuted,
  isUserBanned,
  getAllUsers,
  toggleMuteUser,
  toggleBanUser,
  getUserRateLimit,
  setUserRateLimit,
  getTodayActivityCount,
  adminDeletePost,
  getUnansweredPosts,
  ensureBotUser,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  createReport,
  getReports,
  getPendingReports,
  getHandledReports,
  handleReport,
  getReportStats,
  handleAllReportsForTarget,
  getVisibleArticles,
  getArticleById,
  createArticle,
  approveArticle,
  rejectArticle,
  toggleArticleHidden,
  getPendingArticles,
  getArticleComments,
  createArticleComment,
  toggleLikeArticle,
  toggleLikeArticleComment,
  incrementArticleViews,
  getArticlesByAuthor,
  searchArticles,
  adminDeleteArticle
};
