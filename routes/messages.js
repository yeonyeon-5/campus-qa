const express = require('express');
const router = express.Router();
const db = require('../db');

// 消息中心首页
router.get('/', (req, res) => {
  const who = res.locals.currentUser;
  const tab = req.query.tab || 'notifications';
  const notifications = db.getNotifications(who);
  const chatList = db.getChatList(who);

  // 私聊对话
  const chatWith = (req.query.chat || '').trim();
  let chatMessages = [];
  if (chatWith) {
    chatMessages = db.getConversation(who, chatWith);
  }

  res.render('messages', {
    who,
    tab,
    notifications,
    chatList,
    chatWith,
    chatMessages,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// 发送私信
router.post('/send', (req, res) => {
  const from = res.locals.currentUser;
  const to = (req.body.to || '').trim();
  const content = (req.body.content || '').trim();

  if (from.startsWith('游客_')) {
    return res.send('<script>alert("本社区实行实名制，游客不能发送私信。请退出后以实名登录。");history.back()</script>');
  }
  if (!to || !content) {
    return res.redirect('/messages?tab=chats&error=请填写完整');
  }
  if (to === from) {
    return res.redirect('/messages?tab=chats&error=不能给自己发消息');
  }

  db.sendMessage(from, to, content);
  res.redirect('/messages?tab=chats&chat=' + encodeURIComponent(to) + '&success=发送成功');
});

module.exports = router;
