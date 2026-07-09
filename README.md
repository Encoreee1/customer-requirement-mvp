# 客户需求提交与后台管理 MVP

一个本地运行的测试版网站，支持客户提交需求、多文件上传、客户订单查询、客户补充资料上传、后台登录、订单查看、状态修改和内部备注。

## 技术栈

- 后端：Node.js + Express
- 数据库：SQLite
- 文件上传：multer，本地保存
- 前端：原生 HTML + CSS + JavaScript

## 安装与启动

```bash
npm install
npm start
```

启动后访问：

- 客户提交页：http://localhost:3000/submit
- 客户订单查询页：http://localhost:3000/order-query
- 客户补充资料上传页：http://localhost:3000/supplement-upload
- 后台登录页：http://localhost:3000/admin/login

## 默认后台账号

- 账号：admin
- 密码：admin123

账号密码集中在 `config.js` 中读取，优先使用环境变量：

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=please-change-this-secret
```

可以复制 `.env.example` 为 `.env` 后修改。

## 数据与文件位置

- SQLite 数据库：`data/database.sqlite`
- 上传文件：`uploads/`

上传文件会使用时间戳和随机字符串重命名，避免覆盖已有文件。后台下载时会尽量使用客户上传时的原始文件名。

## 支持上传格式

支持：

- doc、docx、pdf
- xls、xlsx
- ppt、pptx
- zip、rar
- png、jpg、jpeg

单个文件最大 100MB。

## 页面与功能

- `/submit`：客户需求提交页
- `/submit-success`：提交成功详情页
- `/order-query`：客户订单查询页，需要订单号和提交时填写的联系方式
- `/supplement-upload`：客户补充资料上传页，需要订单号和提交时填写的联系方式
- `/admin/login`：后台登录页
- `/admin`：后台订单列表
- `/admin/orders/:id`：订单详情页
- `/admin/logout`：退出登录

后台未登录访问 `/admin` 或订单详情页会跳转到 `/admin/login`。

后台订单列表已支持关键词搜索、状态筛选、任务类型筛选、分页、排序、状态颜色标签和截止时间提醒。筛选条件通过 `/admin` 的 URL query 保留，便于刷新和翻页。

## 项目文档

项目文档位于 `docs/` 目录：

- `PRODUCT_REQUIREMENTS.md`：产品需求
- `API_CONTRACT.md`：接口与路由约定
- `DB_SCHEMA.md`：数据库结构
- `DEV_PLAN.md`：开发计划
- `TEST_CHECKLIST.md`：测试清单

## 本地测试流程

1. 打开 http://localhost:3000/submit
2. 填写客户姓名、联系方式、任务类型、截止时间、具体需求
3. 上传一个或多个支持格式的文件
4. 提交后确认跳转到提交成功详情页，并显示订单编号，例如 `DD20260707001`
5. 打开 http://localhost:3000/order-query
6. 输入订单号和提交时填写的联系方式，确认可查询客户可见订单信息
7. 点击“补充上传资料”，填写补充说明或选择补充文件并提交
8. 打开 http://localhost:3000/admin/login
9. 使用 `admin / admin123` 登录
10. 在后台列表查看刚提交的订单
11. 点击“查看”进入详情页
12. 检查需求内容、备注、原始上传文件列表和客户补充资料区域
13. 点击文件链接下载
14. 修改状态和内部备注并保存
15. 退出登录后，直接访问 `/admin` 会回到登录页

## 后续可优化

- 管理员密码加密存储
- 上传文件病毒扫描
- 更严格的 MIME 类型校验
- 订单删除和导出
- 邮件或短信通知
