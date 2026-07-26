const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const blogRouter = require('./routes/blog');
const adminRouter = require('./routes/admin');
const messagesRouter = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3000;

// 视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 登录检查中间件（登录页和退出除外）
app.use((req, res, next) => {
  const publicPaths = ['/login', '/logout', '/register', '/api/suggest', '/'];
  if (publicPaths.includes(req.path) || req.path.startsWith('/login')) {
    return next();
  }
  if (!req.cookies || !req.cookies.user) {
    return res.redirect('/login');
  }
  // 把当前用户和路径注入所有视图
  res.locals.currentUser = req.cookies.user;
  res.locals.currentPath = req.path;
  const db = require('./db');
  // 封禁用户拒绝访问
  if (db.isUserBanned(req.cookies.user)) {
    res.clearCookie('user');
    return res.redirect('/login?error=账号已被封禁');
  }
  res.locals.getAvatar = function(name) { return db.getAvatarColor(name); };
  res.locals.getAvatarUrl = function(name) { return db.getAvatarUrl(name); };
  next();
});

// 路由
app.use('/', authRouter);
app.use('/', postsRouter);
app.use('/', blogRouter);
app.use('/admin', adminRouter);
app.use('/messages', messagesRouter);
app.use('/blog/messages', messagesRouter);

// 404
app.use((req, res) => {
  res.status(404).render('404', { message: '页面不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('404', { message: '服务器内部错误，请稍后再试' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`校园问答论坛已启动: http://localhost:${PORT}`);
  // 启动机器人：每1小时检查无人回复的帖子
  const bot = require('./bot');
  bot.autoReplyToUnanswered();
  setInterval(() => bot.autoReplyToUnanswered(), 3600000);
});
