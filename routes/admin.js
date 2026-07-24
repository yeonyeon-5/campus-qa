const express = require('express');
const router = express.Router();
const db = require('../db');

// 管理页 - 查看所有帖子
router.get('/', (req, res) => {
  const posts = db.getAllPosts();
  res.render('admin', { posts, message: req.query.message });
});

// 切换帖子隐藏状态
router.post('/:id/toggle', (req, res) => {
  const postId = req.params.id;
  const newState = db.togglePostHidden(postId);

  if (newState === null) {
    return res.redirect('/admin?message=帖子不存在');
  }

  const action = newState ? '已隐藏' : '已显示';
  res.redirect(`/admin?message=帖子${action}`);
});

module.exports = router;
