const express = require('express');
const router = express.Router();
const db = require('../db');

router.use((req, res, next) => {
  if (res.locals.currentUser !== 'admin') {
    return res.status(403).render('404', { message: '仅管理员可访问' });
  }
  next();
});

// 默认跳转仪表盘
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// ===== 仪表盘 =====
router.get('/dashboard', (req, res) => {
  const ranked = db.getPostsWithHeat();
  const allArticles = db.getVisibleArticles(null);
  const pendingArticles = db.getPendingArticles();
  const stats = {
    total: ranked.length,
    visible: ranked.filter(p => !p.is_hidden || p.status === 'approved').length,
    pending: db.getPendingPosts().length,
    totalHeat: ranked.reduce((s, p) => s + p.heat, 0),
    totalReplies: ranked.reduce((s, p) => s + p.reply_count, 0),
    totalLikes: ranked.reduce((s, p) => s + p.like_count, 0),
    blogTotal: allArticles.length,
    blogPending: pendingArticles.length,
  };
  res.render('admin-dashboard', { page: 'dashboard', ranked, stats });
});

// ===== 审核帖子 =====
router.get('/review', (req, res) => {
  const pending = db.getPendingPosts();
  res.render('admin-review', { page: 'review', pending, message: req.query.message });
});

router.post('/review/:id/approve', (req, res) => {
  db.approvePost(req.params.id);
  res.redirect('/admin/review?message=审核通过');
});

router.post('/review/:id/reject', (req, res) => {
  db.rejectPost(req.params.id, (req.body.reason || '').trim());
  res.redirect('/admin/review?message=已驳回');
});

// ===== 帖子管理 =====
router.get('/posts', (req, res) => {
  const posts = db.getAllPosts();
  res.render('admin-posts', { page: 'posts', posts, message: req.query.message });
});

router.post('/posts/:id/toggle', (req, res) => {
  const result = db.togglePostHidden(req.params.id);
  const act = result ? '已隐藏' : '已显示';
  res.redirect('/admin/posts?message=帖子' + act);
});

router.post('/posts/:id/delete', (req, res) => {
  db.adminDeletePost(req.params.id);
  res.redirect('/admin/posts?message=帖子已删除');
});

// ===== 用户管理 =====
router.get('/users', (req, res) => {
  const users = db.getAllUsers();
  res.render('admin-users', { page: 'users', users, message: req.query.message });
});

router.post('/users/:name/mute', (req, res) => {
  const result = db.toggleMuteUser(req.params.name);
  const act = result ? '已禁言' : '已解除禁言';
  res.redirect('/admin/users?message=' + req.params.name + act);
});

router.post('/users/:name/ban', (req, res) => {
  const result = db.toggleBanUser(req.params.name);
  const act = result ? '已封禁' : '已解除封禁';
  res.redirect('/admin/users?message=' + req.params.name + act);
});

router.post('/users/:name/ratelimit', (req, res) => {
  const limit = parseInt(req.body.limit) || 0;
  db.setUserRateLimit(req.params.name, limit);
  const msg = limit > 0 ? '每日限流已设为' + limit + '条' : '已取消限流';
  res.redirect('/admin/users?message=' + req.params.name + msg);
});

// ===== 公告管理 =====
router.get('/announcements', (req, res) => {
  const announcements = db.getAnnouncements();
  res.render('admin-announcements', { page: 'announcements', announcements, message: req.query.message, error: req.query.error });
});

router.post('/announcements/create', (req, res) => {
  const t = (req.body.title || '').trim();
  const c = (req.body.content || '').trim();
  if (!t || !c) return res.redirect('/admin/announcements?error=标题和内容不能为空');
  db.createAnnouncement(t, c, 'admin');
  res.redirect('/admin/announcements?message=公告已发布');
});

router.post('/announcements/:id/delete', (req, res) => {
  db.deleteAnnouncement(req.params.id);
  res.redirect('/admin/announcements?message=公告已删除');
});

// ===== 举报管理 =====
router.get('/reports', (req, res) => {
  const tab = req.query.tab || 'active';
  const catFilter = req.query.cat || '';
  const stats = db.getReportStats(catFilter);
  const history = db.getHandledReports();
  res.render('admin-reports', { page: 'reports', tab, stats, history, catFilter, message: req.query.message });
});

// 一键处理某目标所有举报 + 对目标执行操作
router.post('/reports/bulk', (req, res) => {
  const { type, target_id, action } = req.body;
  if (action === 'hide' && type === 'post') {
    const post = db.getPostById(target_id);
    if (post && !post.is_hidden) db.togglePostHidden(target_id);
  } else if (action === 'mute' && type === 'user') {
    if (!db.isUserMuted(target_id)) db.toggleMuteUser(target_id);
  } else if (action === 'ban' && type === 'user') {
    if (!db.isUserBanned(target_id)) db.toggleBanUser(target_id);
  } else if (action === 'limit3' && type === 'user') {
    db.setUserRateLimit(target_id, 3);
  } else if (action === 'delete' && type === 'post') {
    db.adminDeletePost(target_id);
  }
  db.handleAllReportsForTarget(type, target_id);
  res.redirect('/admin/reports?message=已处理并移入历史');
});

// ===== 博客文章审核 =====
router.get('/articles/review', (req, res) => {
  const pending = db.getPendingArticles();
  res.render('admin-articles-review', { page: 'articles-review', pending, message: req.query.message });
});

router.post('/articles/review/:id/approve', (req, res) => {
  db.approveArticle(req.params.id);
  res.redirect('/admin/articles/review?message=文章审核通过');
});

router.post('/articles/review/:id/reject', (req, res) => {
  db.rejectArticle(req.params.id, (req.body.reason || '').trim());
  res.redirect('/admin/articles/review?message=文章已驳回');
});

// ===== 博客文章管理 =====
router.get('/articles', (req, res) => {
  const articles = db.getVisibleArticles(null);
  res.render('admin-articles', { page: 'articles', articles, message: req.query.message });
});

router.post('/articles/:id/toggle', (req, res) => {
  const result = db.toggleArticleHidden(req.params.id);
  const act = result ? '已隐藏' : '已显示';
  res.redirect('/admin/articles?message=文章' + act);
});

router.post('/articles/:id/delete', (req, res) => {
  db.adminDeleteArticle(req.params.id);
  res.redirect('/admin/articles?message=文章已删除');
});

module.exports = router;
