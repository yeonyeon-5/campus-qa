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

// 首页 - 帖子列表
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const posts = q ? db.searchPosts(q) : db.getVisiblePosts();
  const success = req.query.success;
  const error = req.query.error;
  res.render('index', { posts, success, error, query: q });
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
  db.createPost(trimmedTitle, trimmedContent, author);
  res.redirect('/?success=发帖成功');
});

// 帖子详情页
router.get('/post/:id', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) {
    return res.status(404).render('404', { message: '帖子不存在或已被删除' });
  }
  const who = res.locals.currentUser;
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
  const bookmarkedPosts = db.getBookmarkedPosts(who);
  const notifications = db.getNotifications(who);
  res.render('me', {
    who, tab,
    posts: authorPosts,
    replies: authorReplies,
    bookmarks: bookmarkedPosts,
    notifications,
    notFound: authorPosts.length === 0 && authorReplies.length === 0 && bookmarkedPosts.length === 0,
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

// 用户主页
router.get('/user/:name', (req, res) => {
  const name = req.params.name;
  const posts = db.getPostsByAuthor(name);
  const replyCount = db.getRepliesByAuthor(name).length;
  const info = db.getUserInfo(name);
  res.render('user', { name, posts, replyCount, info });
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

module.exports = router;
