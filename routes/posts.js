const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: function(req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) { cb(null, true); }
    else { cb(new Error('仅支持 jpg/png/gif/webp 格式')); }
  }
});

// 主页面 - 问答 + 博客入口 Hub
router.get('/', (req, res) => {
  const allPosts = db.getVisiblePosts();
  const allArticles = db.getVisibleArticles(null);
  const qaCount = allPosts.length;
  const blogCount = allArticles.length;
  const userCount = db.getAllUsers().length;
  // 最新 3 条帖子和文章预览
  const recentPosts = allPosts.slice(0, 3);
  const recentArticles = allArticles.slice(0, 3);
  res.render('home', {
    qaCount, blogCount, userCount,
    recentPosts, recentArticles,
    currentUser: req.cookies ? req.cookies.user : null
  });
});

// Q&A 首页
router.get('/qa', (req, res) => {
  const q = (req.query.q || '').trim();
  const posts = q ? db.searchPosts(q) : db.getVisiblePosts();
  const announcements = db.getAnnouncements();
  const success = req.query.success;
  const error = req.query.error;
  res.render('index', { posts, announcements, success, error, query: q });
});

// 搜索建议 API
router.get('/api/suggest', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const posts = db.searchPosts(q);
  res.json(posts.slice(0, 5).map(p => ({ id: p.id, title: p.title })));
});

// 发帖页面
router.get('/new', (req, res) => {
  res.render('new-post', { error: null, form: {} });
});

// 提交新帖子
router.post('/post', (req, res) => {
  const { title, content } = req.body;
  const author = res.locals.currentUser;
  const trimmedTitle = (title || '').trim();
  const trimmedContent = (content || '').trim();

  if (!trimmedTitle) {
    return res.render('new-post', { error: '标题不能为空', form: { title, content } });
  }
  if (!trimmedContent) {
    return res.render('new-post', { error: '内容不能为空', form: { title, content } });
  }
  if (trimmedTitle.length > 100) {
    return res.render('new-post', { error: '标题不能超过 100 个字', form: { title, content } });
  }

  if (author.startsWith('游客_')) {
    return res.send('<script>alert("本社区实行实名制，游客不能发帖。请退出后以实名登录。");history.back()</script>');
  }
  if (db.isUserMuted(author)) {
    return res.send('<script>alert("你已被禁言，无法发帖。如有疑问请联系管理员。");history.back()</script>');
  }
  if (db.getUserRateLimit(author) > 0 && db.getTodayActivityCount(author) >= db.getUserRateLimit(author)) {
    return res.send('<script>alert("你今日发帖已达上限（' + db.getUserRateLimit(author) + '条/天），请明天再试。");history.back()</script>');
  }
  db.createPost(trimmedTitle, trimmedContent, author);
  res.redirect('/?success=帖子已提交，等待管理员审核后公开');
});

// 帖子详情页
router.get('/post/:id', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) {
    return res.status(404).render('404', { message: '帖子不存在或已被删除' });
  }
  const who = res.locals.currentUser;
  // 审核中/已驳回的帖子，仅作者本人可见
  if (post.is_hidden && post.author !== who) {
    return res.status(404).render('404', { message: '帖子不存在或审核中' });
  }
  const replies = db.getRepliesByPostId(req.params.id);
  const isBookmarked = db.isBookmarked(who, req.params.id);
  const bookmarkCount = db.getBookmarkCount(req.params.id);
  // 检查当前用户是否已点赞
  const postLiked = (post.likes || []).includes(who);
  const repliesWithState = replies.map(r => ({
    ...r,
    liked: (r.likes || []).includes(who)
  }));

  res.render('post', {
    post: { ...post, liked: postLiked },
    replies: repliesWithState,
    isBookmarked,
    bookmarkCount,
    error: null,
    success: req.query.success
  });
});

// 提交回复
router.post('/post/:id/reply', (req, res) => {
  const postId = req.params.id;
  const post = db.getPostById(postId);
  if (!post) {
    return res.status(404).render('404', { message: '帖子不存在或已被删除' });
  }
  const author = res.locals.currentUser;
  if (author.startsWith('游客_')) {
    return res.send('<script>alert("本社区实行实名制，游客不能回复。请退出后以实名登录。");history.back()</script>');
  }
  if (db.isUserMuted(author)) {
    return res.send('<script>alert("你已被禁言，无法回复。如有疑问请联系管理员。");history.back()</script>');
  }
  if (db.getUserRateLimit(author) > 0 && db.getTodayActivityCount(author) >= db.getUserRateLimit(author)) {
    return res.send('<script>alert("你今日发帖已达上限（' + db.getUserRateLimit(author) + '条/天），请明天再试。");history.back()</script>');
  }
  const { content } = req.body;
  const trimmedContent = (content || '').trim();
  if (!trimmedContent) {
    const replies = db.getRepliesByPostId(postId);
    return res.render('post', { post, replies, error: '回复内容不能为空', success: null, isBookmarked: false, bookmarkCount: 0 });
  }
  db.createReply(postId, trimmedContent, author);
  res.redirect(`/post/${postId}?success=回复成功`);
});

// 点赞帖子
router.post('/post/:id/like', (req, res) => {
  const who = res.locals.currentUser;
  db.toggleLikePost(req.params.id, who);
  res.redirect(`/post/${req.params.id}`);
});

// 点赞回复
router.post('/reply/:id/like', (req, res) => {
  const who = res.locals.currentUser;
  db.toggleLikeReply(req.params.id, who);
  const back = req.get('Referer') || '/';
  res.redirect(back);
});

// 收藏帖子
router.post('/post/:id/bookmark', (req, res) => {
  const who = res.locals.currentUser;
  db.toggleBookmark(who, req.params.id);
  res.redirect(`/post/${req.params.id}`);
});

// 个人中心
router.get('/me', (req, res) => {
  const who = res.locals.currentUser;
  const tab = req.query.tab || 'posts';
  const authorPosts = db.getPostsByAuthor(who);
  const authorReplies = db.getRepliesByAuthor(who);
  const authorArticles = db.getArticlesByAuthor(who);
  const bookmarkedPosts = db.getBookmarkedPosts(who);
  const notifications = db.getNotifications(who);
  const articleNotifications = db.getArticleCommentNotifications(who);
  // 给每个帖子附加点赞数和收藏数
  const postsWithStats = authorPosts.map(p => ({
    ...p,
    like_count: (p.likes || []).length,
    bookmark_count: db.getBookmarkCount(p.id)
  }));
  const articlesWithStats = authorArticles.map(a => ({
    ...a,
    like_count: (a.likes || []).length
  }));
  const totalPostLikes = authorPosts.reduce((s, p) => s + (p.likes || []).length, 0);
  const totalArticleLikes = authorArticles.reduce((s, a) => s + (a.likes || []).length, 0);
  const totalArticleViews = authorArticles.reduce((s, a) => s + (a.views || 0), 0);
  res.render('me', {
    who, tab,
    posts: postsWithStats,
    replies: authorReplies,
    articles: articlesWithStats,
    bookmarks: bookmarkedPosts,
    notifications,
    articleNotifications,
    stats: {
      postCount: authorPosts.length,
      articleCount: authorArticles.length,
      replyCount: authorReplies.length,
      bookmarkCount: bookmarkedPosts.length,
      totalPostLikes,
      totalArticleLikes,
      totalArticleViews
    },
    notFound: authorPosts.length === 0 && authorReplies.length === 0 && bookmarkedPosts.length === 0 && authorArticles.length === 0,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// 删除自己的帖子
router.post('/me/delete-post/:id', (req, res) => {
  const who = res.locals.currentUser;
  const ok = db.deletePost(req.params.id, who);
  res.redirect('/me?tab=posts&' + (ok ? 'success=帖子已删除' : 'error=删除失败'));
});

// 删除自己的回复
router.post('/me/delete-reply/:id', (req, res) => {
  const who = res.locals.currentUser;
  const ok = db.deleteReply(req.params.id, who);
  res.redirect('/me?tab=replies&' + (ok ? 'success=回复已删除' : 'error=删除失败'));
});

// 公告列表（用户端）
router.get('/announcements', (req, res) => {
  const q = (req.query.q || '').trim();
  let announcements = db.getAnnouncements();
  if (q) {
    announcements = announcements.filter(a => a.title.includes(q) || a.content.includes(q));
  }
  res.render('announcements-list', { announcements, query: q });
});

// 用户主页
router.get('/user/:name', (req, res) => {
  const name = req.params.name;
  const posts = db.getPostsByAuthor(name);
  const replyCount = db.getRepliesByAuthor(name).length;
  const info = db.getUserInfo(name);
  res.render('user', { name, posts, replyCount, info, success: req.query.success || null });
});

// 更换头像颜色
router.post('/me/avatar', (req, res) => {
  const who = res.locals.currentUser;
  const color = parseInt(req.body.color) || 0;
  db.setAvatarColor(who, color);
  res.redirect('/me?success=头像已更新');
});

// 上传头像
router.post('/me/avatar-upload', upload.single('avatar'), (req, res) => {
  const who = res.locals.currentUser;
  if (!req.file) return res.redirect('/me?error=请选择图片');
  const url = '/avatars/' + req.file.filename;
  db.setAvatarUrl(who, url);
  res.redirect('/me?success=头像已更新');
});

// 上传证据
const evidenceDir = path.join(__dirname, '..', 'public', 'evidence');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: evidenceDir,
    filename: function(req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) { cb(null, true); }
    else { cb(new Error('仅支持图片格式')); }
  }
});

// 举报帖子
router.get('/report/post/:id', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) return res.status(404).render('404', { message: '帖子不存在' });
  res.render('report', { type: 'post', target: post, error: null });
});

router.post('/report/post/:id', evidenceUpload.array('evidence', 5), (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) return res.status(404).render('404', { message: '帖子不存在' });
  const category = (req.body.category || '').trim();
  const reason = (req.body.reason || '').trim();
  if (!category) return res.render('report', { type: 'post', target: post, error: '请选择举报类别' });
  if (!reason) return res.render('report', { type: 'post', target: post, error: '请填写举报理由' });
  const files = (req.files || []).map(f => '/evidence/' + f.filename);
  db.createReport('post', post.id, post.title, category, reason, files, res.locals.currentUser);
  res.redirect('/post/' + post.id + '?success=举报已提交，管理员会尽快处理');
});

// 举报用户
router.get('/report/user/:name', (req, res) => {
  res.render('report', { type: 'user', target: { author: req.params.name }, error: null });
});

router.post('/report/user/:name', evidenceUpload.array('evidence', 5), (req, res) => {
  const name = req.params.name;
  const category = (req.body.category || '').trim();
  const reason = (req.body.reason || '').trim();
  if (!category) return res.render('report', { type: 'user', target: { author: name }, error: '请选择举报类别' });
  if (!reason) return res.render('report', { type: 'user', target: { author: name }, error: '请填写举报理由' });
  const files = (req.files || []).map(f => '/evidence/' + f.filename);
  db.createReport('user', name, name, category, reason, files, res.locals.currentUser);
  res.redirect('/user/' + encodeURIComponent(name) + '?success=举报已提交');
});

module.exports = router;
