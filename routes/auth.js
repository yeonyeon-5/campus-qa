const express = require('express');
const router = express.Router();
const db = require('../db');

// 登录页
router.get('/login', (req, res) => {
  if (req.cookies && req.cookies.user) {
    return res.redirect('/');
  }
  res.render('login', { error: null, form: {} });
});

// 密码登录
router.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();
  if (!username || !password) {
    return res.render('login', { error: '请输入账号和密码', form: { username } });
  }
  if (db.verifyLogin(username, password)) {
    res.cookie('user', username, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    return res.redirect('/');
  }
  res.render('login', { error: '账号或密码错误', form: { username } });
});

// 游客登录
router.post('/login/guest', (req, res) => {
  const id = Math.random().toString(36).slice(2, 8);
  const guestName = '游客_' + id;
  res.cookie('user', guestName, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect('/');
});

// 注册页
router.get('/register', (req, res) => {
  if (req.cookies && req.cookies.user) {
    return res.redirect('/');
  }
  res.render('register', { error: null, form: {} });
});

// 注册提交
router.post('/register', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();
  const password2 = (req.body.password2 || '').trim();
  const realname = (req.body.realname || '').trim();
  const studentId = (req.body.studentId || '').trim();

  if (!username || !password || !realname) {
    return res.render('register', { error: '请填写完整信息（姓名必填）', form: { username, realname, studentId } });
  }
  if (realname.length < 2) {
    return res.render('register', { error: '请填写真实姓名', form: { username, realname, studentId } });
  }
  if (username.length < 2 || username.length > 20) {
    return res.render('register', { error: '账号需 2-20 个字符', form: { username, realname, studentId } });
  }
  if (username.startsWith('游客_')) {
    return res.render('register', { error: '账号不能以"游客_"开头，请换一个', form: { username, realname, studentId } });
  }
  if (password.length < 4) {
    return res.render('register', { error: '密码至少 4 位', form: { username, realname, studentId } });
  }
  if (password !== password2) {
    return res.render('register', { error: '两次密码不一致', form: { username, realname, studentId } });
  }

  const result = db.registerUser(username, password, realname, studentId);
  if (!result) {
    return res.render('register', { error: '该账号已被注册，请换一个', form: { username, realname, studentId } });
  }

  res.cookie('user', username, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect('/?success=注册成功，欢迎加入！');
});

// 退出
router.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login');
});

module.exports = router;
