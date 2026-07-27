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

// 手机号登录
router.post('/login', (req, res) => {
  const phone = (req.body.phone || '').trim();
  const password = (req.body.password || '').trim();
  if (!phone || !password) {
    return res.render('login', { error: '请输入手机号和密码', form: { phone } });
  }
  const v = db.verifyLogin(phone, password);
  if (v === 'banned') {
    return res.render('login', { error: '该账号已被封禁，无法登录', form: { phone } });
  }
  if (v) {
    const nickname = db.getUserNickname(phone) || phone;
    res.cookie('user', nickname, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    return res.redirect('/');
  }
  res.render('login', { error: '手机号或密码错误', form: { phone } });
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
  const phone = (req.body.phone || '').trim();
  const password = (req.body.password || '').trim();
  const password2 = (req.body.password2 || '').trim();
  const nickname = (req.body.nickname || '').trim();

  const fd = { phone, nickname };

  if (!phone || !password || !nickname) {
    return res.render('register', { error: '请填写完整信息', form: fd });
  }
  if (!/^1\d{10}$/.test(phone)) {
    return res.render('register', { error: '请输入正确的11位手机号', form: fd });
  }
  if (nickname.length < 2 || nickname.length > 20) {
    return res.render('register', { error: '昵称需 2-20 个字符', form: fd });
  }
  if (password.length < 4) {
    return res.render('register', { error: '密码至少 4 位', form: fd });
  }
  if (password !== password2) {
    return res.render('register', { error: '两次密码不一致', form: fd });
  }

  const result = db.registerUser(phone, password, nickname, '');
  if (!result) {
    return res.render('register', { error: '该手机号已被注册', form: fd });
  }

  res.cookie('user', nickname, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect('/?success=注册成功，欢迎加入！');
});

// 退出
router.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login');
});

module.exports = router;
