const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json');
const MSGS_FILE = path.join(DATA_DIR, 'messages.json');
const BM_FILE = path.join(DATA_DIR, 'bookmarks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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
    is_hidden: false,
    likes: [],
    created_at: now()
  };
  posts.push(post);
  writePosts(posts);
  return post.id;
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
  return hashPassword(password, user.salt) === user.passwordHash;
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

module.exports = {
  getVisiblePosts,
  getPostById,
  getRepliesByPostId,
  createPost,
  createReply,
  getAllPosts,
  togglePostHidden,
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
  getUserInfo
};
