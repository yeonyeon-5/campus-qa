# campus-qa - 校园问答论坛

## 项目简介
大学生校园问答论坛，支持发帖求助、搜索、回复、点赞、收藏、私信等社区功能。

## 技术栈
- **后端**: Express.js 5.x (Node.js)
- **模板引擎**: EJS 6.x
- **数据库**: JSON 文件存储 (`data/` 目录)
- **认证**: Cookie-based session + PBKDF2 密码加密
- **文件上传**: Multer 2.x

## 项目结构
```
campus-qa/
├── server.js          # 入口文件，Express 配置
├── db.js              # 数据层，JSON 文件读写
├── routes/
│   ├── auth.js        # 登录/注册/退出
│   ├── posts.js       # 帖子/回复/点赞/收藏/个人中心
│   ├── admin.js       # 管理后台（隐藏/显示帖子）
│   └── messages.js    # 私信/通知
├── views/             # EJS 模板
│   ├── partials/      # header.ejs, footer.ejs
│   ├── index.ejs      # 首页帖子列表
│   ├── post.ejs       # 帖子详情
│   ├── new-post.ejs   # 发帖
│   ├── login.ejs      # 登录
│   ├── register.ejs   # 注册
│   ├── me.ejs         # 个人中心
│   ├── messages.ejs   # 消息中心
│   ├── user.ejs       # 用户主页
│   ├── admin.ejs      # 管理后台
│   └── 404.ejs        # 404/错误页
├── public/
│   ├── style.css      # 全局样式
│   └── avatars/       # 用户上传头像
└── data/              # JSON 数据文件（不提交 Git）
    ├── posts.json
    ├── replies.json
    ├── messages.json
    ├── bookmarks.json
    └── users.json
```

## 启动方式
```bash
npm start       # 启动服务 (端口 3000)
npm run dev     # nodemon 热重载
```

## 认证规则
- 已登录用户：`res.locals.currentUser` 可用
- 游客（`游客_xxx`）不能发帖/回复/发私信
- Cookie 有效期 30 天，httpOnly
- 公开路径：`/login`, `/register`, `/logout`, `/api/suggest`

## 数据层 (db.js) 关键方法
| 方法 | 说明 |
|------|------|
| `getVisiblePosts()` | 获取可见帖子（含回复数）|
| `createPost(title, content, author)` | 创建帖子 |
| `createReply(postId, content, author)` | 创建回复 |
| `toggleLikePost/LikeReply(id, username)` | 点赞/取消点赞 |
| `toggleBookmark(username, postId)` | 收藏/取消收藏 |
| `sendMessage(from, to, content)` | 发送私信 |
| `searchPosts(keyword)` | 搜索帖子 |
| `getNotifications(author)` | 获取通知 |
| `registerUser(username, password, realname, studentId)` | 注册用户 |
| `verifyLogin(username, password)` | 验证登录 |

## 注意事项
- `data/` 目录包含运行时数据，不要提交到 Git
- 用户密码使用 PBKDF2 (10000 迭代, SHA512) 加盐哈希
- GitHub 远程使用 SSH (`git@github.com:yeonyeon-5/campus-qa.git`)
- 本地 HTTPS 到 GitHub 被墙，`gh` CLI API 不可用，需通过 SSH 操作 git
