const express = require('express');
const router = express.Router();
const db = require('../db');

// 博客首页 - 文章列表
router.get('/blog', (req, res) => {
  const q = (req.query.q || '').trim();
  const cat = (req.query.cat || '').trim();
  let articles = q ? db.searchArticles(q) : db.getVisibleArticles(cat || null);
  const success = req.query.success;
  const error = req.query.error;
  const categories = ['全部', '论文', '笔记', '教程', '资料', '其他'];
  res.render('blog', { articles, categories, currentCat: cat || '全部', query: q, success, error });
});

// 写文章页面
router.get('/blog/new', (req, res) => {
  res.render('write-blog', { error: null, form: {} });
});

// 提交新文章
router.post('/blog', (req, res) => {
  const { title, content, summary, category } = req.body;
  const author = res.locals.currentUser;
  const trimmedTitle = (title || '').trim();
  const trimmedContent = (content || '').trim();

  if (!trimmedTitle) {
    return res.render('write-blog', { error: '标题不能为空', form: { title, content, summary, category } });
  }
  if (!trimmedContent) {
    return res.render('write-blog', { error: '内容不能为空', form: { title, content, summary, category } });
  }
  if (trimmedTitle.length > 100) {
    return res.render('write-blog', { error: '标题不能超过 100 个字', form: { title, content, summary, category } });
  }

  if (author.startsWith('游客_')) {
    return res.send('<script>alert("本社区实行实名制，游客不能发表文章。请退出后以实名登录。");history.back()</script>');
  }
  if (db.isUserMuted(author)) {
    return res.send('<script>alert("你已被禁言，无法发表文章。如有疑问请联系管理员。");history.back()</script>');
  }
  if (db.getUserRateLimit(author) > 0 && db.getTodayActivityCount(author) >= db.getUserRateLimit(author)) {
    return res.send('<script>alert("你今日发帖已达上限（' + db.getUserRateLimit(author) + '条/天），请明天再试。");history.back()</script>');
  }

  const tags = (req.body.tags || '').split(/[,，\s]+/).filter(Boolean);
  db.createArticle(trimmedTitle, trimmedContent, (summary || '').trim(), category || '其他', tags, author);
  res.redirect('/blog?success=文章已提交，等待管理员审核后公开');
});

// 文章详情页
router.get('/blog/:id', (req, res) => {
  const article = db.getArticleById(req.params.id);
  if (!article) {
    return res.status(404).render('404', { message: '文章不存在或已被删除' });
  }
  const who = res.locals.currentUser;
  // 审核中/已驳回的文章，仅作者本人可见
  if (article.is_hidden && article.author !== who) {
    return res.status(404).render('404', { message: '文章不存在或审核中' });
  }
  db.incrementArticleViews(req.params.id);
  article.views = (article.views || 0) + 1;
  const comments = db.getArticleComments(req.params.id);
  const articleLiked = (article.likes || []).includes(who);
  const commentsWithState = comments.map(c => ({
    ...c,
    liked: (c.likes || []).includes(who)
  }));

  res.render('blog-detail', {
    article: { ...article, liked: articleLiked },
    comments: commentsWithState,
    error: null,
    success: req.query.success
  });
});

// 发表评论
router.post('/blog/:id/comment', (req, res) => {
  const articleId = req.params.id;
  const article = db.getArticleById(articleId);
  if (!article) {
    return res.status(404).render('404', { message: '文章不存在或已被删除' });
  }
  const author = res.locals.currentUser;
  if (author.startsWith('游客_')) {
    return res.send('<script>alert("本社区实行实名制，游客不能评论。请退出后以实名登录。");history.back()</script>');
  }
  if (db.isUserMuted(author)) {
    return res.send('<script>alert("你已被禁言，无法评论。如有疑问请联系管理员。");history.back()</script>');
  }
  const { content } = req.body;
  const trimmedContent = (content || '').trim();
  if (!trimmedContent) {
    const comments = db.getArticleComments(articleId);
    return res.render('blog-detail', { article, comments, error: '评论内容不能为空', success: null });
  }
  db.createArticleComment(articleId, trimmedContent, author);
  res.redirect(`/blog/${articleId}?success=评论成功`);
});

// 点赞文章
router.post('/blog/:id/like', (req, res) => {
  const who = res.locals.currentUser;
  db.toggleLikeArticle(req.params.id, who);
  res.redirect(`/blog/${req.params.id}`);
});

// 点赞评论
router.post('/blog/comment/:id/like', (req, res) => {
  const who = res.locals.currentUser;
  db.toggleLikeArticleComment(req.params.id, who);
  const back = req.get('Referer') || '/blog';
  res.redirect(back);
});

module.exports = router;
