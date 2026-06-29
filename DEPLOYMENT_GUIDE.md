# 🚀 部署指南

## ⚠️ 重要：环境变量配置（必须做）

### 第一步：创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - Organization: 选择或创建组织
   - Name: `reservation-system`（随便取）
   - Database Password: 设置强密码（记住它！）
   - Region: 选择最近的区域（如 `Northeast Asia`）

4. 等待项目创建完成（约2分钟）

### 第二步：获取 API 密钥

1. 进入项目 → **Settings** → **API**
2. 找到以下信息：

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.......
```

### 第三步：配置环境变量

打开 `.env.development` 和 `.env.production`，填入真实值：

```env
# .env.development
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.......
```

```env
# .env.production
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.......
```

### 第四步：创建数据库表

在 Supabase Dashboard → **SQL Editor** 中执行 `supabase/migrations/001_initial_schema.sql`。

该脚本包含：
- 所有数据表的创建（幂等设计，可重复执行）
- users 表与 auth.users 的关联
- 自动同步用户的触发器
- 所有表的行级安全（RLS）+ 强制 RLS
- 完整的 RLS 策略
- 索引优化
- 初始示例数据

### 第五步：测试本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`，测试：
1. 注册账号：admin@admin.com / admin123
2. 登录后自动进入管理后台
3. 测试类别管理、仪器管理、预约功能

### 第六步：部署到 GitHub Pages

1. 确认 `vite.config.js` 中的 `base` 路径：
```javascript
export default defineConfig({
  base: '/你的仓库名/',
  // ...
})
```

2. 推送代码到 GitHub main 分支

3. GitHub Actions 会自动构建并部署到 gh-pages 分支

4. 在 GitHub 仓库 Settings → Pages 中：
   - Source: Deploy from a branch
   - Branch: gh-pages / (root)

---

## 🔐 安全说明

### 行级安全（RLS）

所有数据表均启用并强制 RLS：

| 表 | 读权限 | 写权限 |
|----|--------|--------|
| users | 用户只能读自己 | 用户只能改自己 |
| category | 公开读 | 管理员可写 |
| instrument | 公开读 | 管理员可写 |
| time_slot | 公开读 | 管理员可写 |
| booking | 用户读自己的，管理员读全部 | 用户改自己的，管理员改全部 |
| lock | 公开读 | 管理员可写 |
| settings | 公开读 | 管理员可写 |

### 用户认证

- 使用 Supabase Auth 进行邮箱密码认证
- admin@admin.com 自动获得管理员角色
- 用户数据通过触发器自动同步到 public.users 表

---

## ❌ 常见问题

### Q1: 登录后没反应？
→ 检查浏览器控制台（F12），看是否有 Network Error
→ 确认 `.env.production` 中的 URL 和 KEY 正确
→ 确认数据库表已创建，RLS 策略已启用

### Q2: 请求失败 403？
→ 检查 RLS 策略是否正确配置
→ 确认用户是否已登录
→ 检查用户角色权限

### Q3: CORS 错误？
→ Supabase 默认允许所有域名，不需要额外配置
→ 确保使用 HTTPS 协议

### Q4: GitHub Pages 刷新 404？
→ 确保 Vue Router 使用 hash 模式（createWebHashHistory）
→ 本项目已配置为 hash 模式，不会出现此问题

### Q5: 注册后用户角色不对？
→ 只有 admin@admin.com 会自动成为管理员
→ 其他用户默认是普通用户角色

---

## 📁 文件结构

```
src/
├── api/                  # 数据访问层
│   ├── category.js       # 类别 API
│   ├── instrument.js     # 仪器 API
│   ├── booking.js        # 预约 API
│   ├── timeSlot.js       # 时段 API
│   ├── user.js           # 用户 API
│   └── index.js          # 统一导出
├── lib/
│   └── supabase.js       # Supabase 客户端
├── layout/               # 布局组件
├── views/                # 页面组件
│   ├── user/             # 用户端页面
│   └── admin/            # 管理员端页面
├── router/               # 路由配置
├── permission/           # 路由权限守卫
└── utils/                # 工具函数
```

---

**✅ 完成以上步骤后，你的应用就能正常工作了！**
