# 科研仪器预约系统

一个基于 Vue 3 + Vite + Supabase 开发的科研仪器预约管理系统，支持用户预约、管理员后台、时段锁定等功能。

---

## 功能特性

### 用户端
- **类别选择**：按仪器类别浏览可预约设备
- **时段预约**：选择日期和时段进行预约，支持多选批量预约
- **预约规则**：支持预约开放天数等灵活配置
- **我的预约**：查看已提交的预约记录，支持取消预约
- **实时可用概览**：展示各仪器的实时可用状态

### 管理员端
- **类别管理**：新增、编辑、删除仪器类别
- **仪器管理**：按类别新增、编辑、删除仪器
- **用户管理**：查看所有注册用户
- **时间段管理**：按类别自定义可预约时间段
- **锁定管理**：按仪器或类别锁定特定日期或时段
- **预约设置**：配置预约开放天数
- **预约记录**：查看所有用户的预约记录，支持状态管理
- **密码管理**：修改管理员登录密码

---

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.5.17 | 前端框架 |
| Vite | 5.4.19 | 构建工具 |
| Vue Router | 4.6.4 | 路由管理 |
| Supabase | - | 后端云数据库与 Auth 认证 |

---

## 项目结构

```
.
├── src/
│   ├── api/             # 数据访问层（基于 Supabase）
│   ├── lib/             # 公共库（Supabase 客户端）
│   ├── layout/          # 布局组件
│   ├── views/           # 页面组件
│   │   ├── user/        # 用户端页面
│   │   └── admin/       # 管理员端页面
│   ├── router/          # 路由配置
│   ├── permission/      # 路由权限守卫
│   ├── utils/           # 工具函数
│   ├── App.vue          # 根组件
│   └── main.js          # 入口文件
├── supabase/
│   └── migrations/      # 数据库迁移脚本
├── .env.development     # 开发环境变量
├── .env.production      # 生产环境变量
├── vite.config.js       # Vite 配置
└── package.json
```

---

## 快速开始

### 1. 克隆项目

```bash
git clone <仓库地址>
cd Reservation-system-main
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 Supabase

编辑 `.env.development` 和 `.env.production`，填入你的 Supabase 配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 初始化数据库

在 Supabase Dashboard → SQL Editor 中执行 `supabase/migrations/001_initial_schema.sql`。

### 5. 本地开发

```bash
npm run dev
```

默认在 `http://localhost:5173` 启动。

### 6. 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

---

## 数据库表结构

系统包含以下数据表：

| 表名 | 说明 |
|------|------|
| `users` | 用户表（关联 auth.users） |
| `category` | 仪器类别 |
| `instrument` | 仪器设备 |
| `time_slot` | 预约时段 |
| `booking` | 预约记录 |
| `lock` | 时段锁定 |
| `settings` | 系统设置 |

所有表均启用 **行级安全（RLS）** 并强制 RLS，确保数据安全。

---

## 部署

### GitHub Pages 部署

项目已配置 GitHub Actions 自动部署，推送到 `main` 分支即可自动构建并部署。

**注意事项：**
1. 确保 `vite.config.js` 中的 `base` 路径与 GitHub 仓库名一致
2. 配置 `.env.production` 中的生产环境变量
3. 在 GitHub 仓库 Settings → Pages 中选择 `gh-pages` 分支

---

## 默认账号

- **管理员邮箱**：admin@admin.com
- **管理员密码**：admin123

注册 `admin@admin.com` 邮箱的账号会自动获得管理员权限。

---

## License

Private
