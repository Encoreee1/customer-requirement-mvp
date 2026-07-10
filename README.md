# 客户需求提交与后台管理 MVP

一个本地运行的测试版网站，支持客户提交需求、多文件上传、客户订单查询、客户补充资料上传、后台登录、订单查看、管理员成品交付、客户成品下载、状态修改和内部备注。

当前正式版本：V1.2.3 客户补充资料上传版。

当前开发分支已实现 V1.3 管理员成品上传与客户下载功能，待测试验收，尚未作为正式版本发布。

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

后台订单详情页支持按“原始上传文件 / 客户补充资料 / 成品交付”分区查看文件。管理员可以在“成品交付”区域填写交付说明、上传一个或多个成品文件，成品上传不会自动修改订单状态。

客户在 `/order-query` 查询订单成功后，可以查看成品交付信息，并通过订单号、联系方式和下载凭证下载属于自己订单的成品文件。

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
12. 检查需求内容、备注、原始上传文件列表、客户补充资料区域和成品交付区域
13. 在成品交付区域填写交付说明或上传成品文件
14. 回到订单查询页，确认客户可见成品交付并可下载成品文件
15. 点击后台文件链接下载
16. 修改状态和内部备注并保存
17. 退出登录后，直接访问 `/admin` 会回到登录页

## 当前版本与下一步

- 当前已支持：客户提交需求、客户查询订单、客户补充资料上传、后台订单管理、管理员成品上传与客户成品下载。
- 当前 V1.3 功能处于待测试验收状态，尚未作为正式发布版本。
- 文件在线预览、文件删除、文件分类、统计导出、正式上线准备等方向暂不作为当前下一版本主线。
