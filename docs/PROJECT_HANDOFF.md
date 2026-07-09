# 项目交接记录

## 一、项目名称

客户需求提交与后台管理系统

## 二、当前版本状态

当前版本：V1.2.2 客户订单查询版

状态：已实现并通过测试验收

发布状态：V1.2.2 已正式发布到 GitHub，`main` 分支已推送，`v1.2.2` tag 已推送

## 三、技术栈

- Node.js + Express
- SQLite
- multer
- 原生 HTML + CSS + JavaScript
- 本地运行：`npm install` / `npm start`

## 四、当前已完成内容

### V1.0 MVP 已完成

1. 客户提交需求
2. 多文件上传
3. 后台管理员登录
4. 后台订单列表
5. 订单详情查看
6. 上传文件下载
7. 订单状态修改
8. 内部备注修改
9. SQLite 数据库存储
10. uploads 文件夹保存客户上传材料

### 项目文档体系已完成

1. `docs/PRODUCT_REQUIREMENTS.md`
2. `docs/API_CONTRACT.md`
3. `docs/DB_SCHEMA.md`
4. `docs/DEV_PLAN.md`
5. `docs/TEST_CHECKLIST.md`
6. `docs/PROJECT_HANDOFF.md`

### 前置修复已完成

1. 后台登录失败时显示“账号或密码不正确”提示

### V1.1 后台管理增强已完成

1. 后台关键词搜索
2. 状态筛选
3. 任务类型筛选
4. 组合筛选
5. 分页
6. 每页 10 / 20 / 50 条切换
7. 排序：最新提交、最早提交、截止最近、截止最晚
8. 状态颜色标签
9. 截止时间提醒：已逾期、今日截止、3天内截止
10. URL query 条件保留
11. 非法参数兜底
12. 未登录 API 保护

### V1.2.1 提交成功详情页已完成

1. 客户提交需求成功后跳转提交成功详情页。
2. 成功页展示订单号、任务类型、联系方式、截止时间、提交时间、当前状态。
3. 成功页提示客户保存订单号。
4. 成功页提供继续提交新需求入口。
5. 支持刷新成功页。
6. 无 `sessionStorage` 时展示订单号和兜底提示。
7. 异常订单号或缺失订单号时页面不崩溃、不空白。
8. 无法确认订单真实性时，状态显示“无法确认”，不默认显示“未处理”。
9. 未引入客户查询、客户登录、补充资料上传、客户可见进度备注等后续功能。
10. 本次未修改数据库结构。

### V1.2.2 客户订单查询功能已完成

1. 新增客户订单查询页：`/order-query` 和 `/order-query.html`。
2. 客户可以通过“订单号 + 联系方式”查询本人订单基础状态。
3. 新增查询接口：`POST /api/customer/orders/query`。
4. 查询成功后展示订单号、任务类型、联系方式、截止时间、提交时间、当前状态、需求描述摘要和文件数量。
5. 查询失败时统一提示，不区分“订单号不存在”还是“联系方式错误”。
6. 查询接口同时兼容 `order_no` 和 `orderNo`。
7. 提交页 `/submit` 已增加“已有订单？查询进度”入口。
8. 提交成功页 `/submit-success` 已增加“查询订单进度”入口，并可预填订单号。
9. 查询必须同时校验订单号和联系方式，不能只凭订单号查询。
10. 客户查询结果不展示后台内部备注。
11. 客户查询结果不返回数据库内部 ID。
12. 客户查询结果不返回服务器文件路径、真实存储文件名或下载地址。
13. 未开放客户修改订单能力。
14. 未开放客户补充上传资料能力。
15. 未实现客户登录、短信验证码、邮件通知、客户可见进度备注等后续功能。
16. 本次未修改数据库结构。

## 五、主要变更文件

V1.2.1 开发涉及的主要文件：

1. `server.js`
2. `database.js`
3. `public/submit.html`
4. `public/submit-success.html`
5. `public/js/main.js`
6. `public/css/style.css`
7. `docs/API_CONTRACT.md`
8. `docs/DEV_PLAN.md`
9. `docs/TEST_CHECKLIST.md`
10. `README.md`

后续小修复涉及：

1. `public/js/main.js`
2. `docs/TEST_CHECKLIST.md`

V1.2.2 开发涉及的主要文件：

1. `server.js`
2. `database.js`
3. `public/order-query.html`
4. `public/submit.html`
5. `public/submit-success.html`
6. `public/js/main.js`
7. `public/css/style.css`
8. `scripts/smoke-test.py`
9. `README.md`
10. `docs/API_CONTRACT.md`
11. `docs/DEV_PLAN.md`
12. `docs/TEST_CHECKLIST.md`
13. `docs/PRODUCT_REQUIREMENTS.md`

V1.2.2 功能实现阶段没有修改：

1. `docs/DB_SCHEMA.md`
2. `docs/PROJECT_HANDOFF.md` 在功能实现阶段未提前标记通过

## 六、V1.1 验收结果

测试日期：2026-07-07

测试环境：Windows / Node.js v24.16.0 / SQLite / Chrome Headless

测试地址：[http://localhost:3002](http://localhost:3002/)

测试结论：V1.1 通过验收

是否存在阻断问题：否

## 七、V1.2.1 验收结果

测试日期：2026-07-08

测试环境：Windows / Node.js v24.16.0 / SQLite / Chrome Headless / Playwright

测试地址：

- [http://localhost:3003](http://localhost:3003/)
- [http://localhost:3004](http://localhost:3004/)

测试结论：V1.2.1 通过验收

是否存在阻断问题：否

### 第一轮验收

结论：有条件通过。

测试环境：

- Windows
- Node.js v24.16.0
- npm 11.13.0
- Chrome Headless / Playwright
- 启动端口：3003
- 测试时间：2026-07-08 00:02 左右

第一轮发现的问题：

1. 无 `sessionStorage` 或异常订单号访问成功页时，页面仍默认显示“当前状态：未处理”，容易被理解为已确认订单状态。

修复方向：

1. 无可用 `sessionStorage` 时，不使用 `detail.status || '未处理'` 作为默认值，改为显示“无法确认”或同等兜底文案。

### 修复后复验

结论：通过。

复验环境：

- Microsoft Windows 11 家庭版 中文版，64-bit
- Node.js v24.16.0
- Python Playwright 1.60.0 + Chrome Headless 149.0.7827.201
- 启动端口：3004
- 复验时间：2026-07-08 00:34-00:46，UTC+08:00

复验结果：

1. 正常提交路径通过。
2. 成功页刷新通过。
3. 无 `sessionStorage` 访问真实订单号通过。
4. 异常 URL 访问通过。
5. 继续提交新需求通过。
6. 文档复验通过。
7. 未发现问题。
8. 未捕获到 JS `pageerror`。
9. 打开 `/submit` 时 Chrome 控制台曾出现一次资源 404 提示，但不影响页面加载、提交或 V1.2.1 验收目标，未作为问题记录。

## 八、V1.2.2 验收结果

测试日期：2026-07-08

测试环境：Microsoft Windows 11 家庭版 中文版，10.0.26200，64-bit / Node.js v24.16.0 / npm 11.13.0 / SQLite / Chrome Headless 149.0.7827.201 / Python Playwright 1.60.0

测试地址：[http://localhost:3005](http://localhost:3005/)

启动端口：3005

测试时间：2026-07-08 15:51 +08:00

当前 Git 分支：`feature/v1.2.2-customer-query`

测试结论：V1.2.2 通过验收

是否存在阻断问题：否

测试结果概要：

1. `/submit`、`/submit-success`、`/order-query`、`/order-query.html` 均可访问。
2. 正确订单号 + 正确联系方式查询成功。
3. 正确订单号 + 错误联系方式查询失败。
4. 错误订单号 + 正确联系方式查询失败。
5. 缺参返回 400。
6. 不匹配返回 404。
7. 失败提示统一，不泄露具体原因。
8. `order_no` 和 `orderNo` 均可兼容。
9. 订单号和联系方式前后空格可 trim 后查询。
10. 客户查询页面和接口 JSON 均未泄露后台内部备注。
11. 客户查询结果未泄露数据库 ID。
12. 客户查询结果未泄露服务器文件路径、真实存储文件名或下载地址。
13. 未开放客户修改订单能力。
14. 未开放客户补传资料能力。
15. V1.2.1 提交成功页回归通过。
16. V1.1 后台核心功能回归通过。
17. `docs/API_CONTRACT.md`、`docs/DEV_PLAN.md`、`docs/TEST_CHECKLIST.md`、`README.md`、`docs/PRODUCT_REQUIREMENTS.md`、`docs/DB_SCHEMA.md` 一致。
18. 未发现问题。

## 九、测试产生的数据

### V1.1 测试产生的数据

测试订单包括：

- `DD20260707008`
- `DD20260707009` 至 `DD20260707029`

其中 `DD20260707009` 上传了：

- `v11-sample.pdf`
- `v11-sample.png`
- `v11-sample.xlsx`

这些测试数据暂未删除。

### V1.2.1 测试产生的数据

测试订单包括：

- `DD20260708004`
- `DD20260708005`
- `DD20260708006`
- `DD20260708007`
- `DD20260708008`
- `DD20260708009`

其中第一轮测试上传了：

- `v121-success-page.pdf`
- `v121-success-page.png`

功能实现小修复自测产生订单：

- `DD20260708007`

针对性复验产生订单：

- `DD20260708008`
- `DD20260708009`

针对性复验未上传文件。

这些测试数据暂未删除。

### V1.2.2 测试产生的数据

本次测试产生订单：

- `DD20260708013`
- `DD20260708014`
- `DD20260708015`

上传测试文件：

- `v122-query-sample.pdf`

内部备注隔离测试关键词：

- `V1.2.2 internal note should not be visible to customer`

这些测试数据暂未删除。

## 十、当前已知注意事项

1. 本地 3000 和 3001 端口曾有旧 `node server.js` 进程占用。
2. 测试新版功能前需要确认当前运行的是最新代码。
3. 如端口被占用，可以关闭旧 Node 进程，或使用 `PORT=3002 npm start` 临时启动。
4. 当前数据库结构未因 V1.1 改动。
5. 当前上传文件保存逻辑未因 V1.1 改动。
6. V1.2.1 未新增数据库结构。
7. V1.2.1 未实现客户订单查询功能。
8. 提交成功页在无 `sessionStorage` 或异常订单号时，只做兜底展示，不会查询订单详情。
9. 如需客户后续查看订单状态，应在 V1.2.2 单独设计客户订单查询功能。
10. V1.2.2 未新增数据库结构。
11. V1.2.2 客户查询必须同时校验订单号和联系方式。
12. 客户查询结果不展示后台内部备注。
13. 客户查询结果不返回数据库内部 ID、服务器文件路径、真实存储文件名或下载地址。
14. 当前仍未实现客户登录。
15. 当前仍未实现客户补充资料上传。
16. 当前仍未实现客户可见进度备注字段。
17. 客户可见进度备注功能暂缓，不作为当前下一版本目标，可作为后续可选优化。
18. 下一版本目标调整为 V1.2.3 客户补充资料上传功能。

## 十一、重要文件

后续开发前建议先阅读：

1. `README.md`
2. `docs/PRODUCT_REQUIREMENTS.md`
3. `docs/API_CONTRACT.md`
4. `docs/DB_SCHEMA.md`
5. `docs/DEV_PLAN.md`
6. `docs/TEST_CHECKLIST.md`
7. `docs/PROJECT_HANDOFF.md`
8. `server.js`
9. `database.js`
10. `public/js/main.js`
11. `public/css/style.css`
12. `public/submit-success.html`
13. `public/order-query.html`
14. `views/admin-list.html`
15. `views/admin-detail.html`

## 十二、下一步建议

建议进入 V1.2.3 客户补充资料上传功能开发。

V1.2.3 建议范围：

1. 客户通过订单号 + 联系方式验证订单。
2. 验证通过后，可以为原订单补充上传资料。
3. 客户可以填写补充说明。
4. 补充资料与原订单关联。
5. 后台订单详情页可以查看补充资料和补充说明。
6. 不允许客户修改原订单基础信息。
7. 不允许客户修改订单状态。
8. 不开放客户登录系统。
9. 不做聊天系统。
10. 不做客户可见进度备注。
11. 不做复杂消息通知。

客户可见进度备注功能暂缓，不作为当前下一版本目标，可作为后续可选优化。

## 十三、协作模式

继续采用三会话协作模式：

1. ChatGPT 网页会话：项目总控，负责拆任务、写提示词、审查结果。
2. Codex 功能实现会话：负责实现指定功能。
3. Codex 测试验收会话：负责测试和输出问题清单。
