# 接口与路由约定

## 1. 文档目的

本文档记录当前项目已经实现的页面路由、JSON 接口、表单字段、后台保护规则和文件下载规则。后续新增或修改接口时，必须先同步更新本文档，避免前端、后端和测试验收标准不一致。

## 2. 当前架构说明

当前项目不是标准前后端分离 API 项目，而是 Express 提供 HTML 页面和静态资源，前端页面通过原生 JavaScript `fetch` 调用少量 JSON 接口。

当前页面文件位置：

- 客户提交页：`public/submit.html`
- 提交成功详情页：`public/submit-success.html`
- 后台登录页：`views/admin-login.html`
- 后台列表页：`views/admin-list.html`
- 后台详情页：`views/admin-detail.html`
- 前端脚本：`public/js/main.js`
- 样式文件：`public/css/style.css`

除非明确进行版本迭代，不应改变现有页面路径。

## 3. 页面路由

| 方法 | 路径 | 登录要求 | 当前行为 |
| --- | --- | --- | --- |
| GET | `/` | 否 | 重定向到 `/submit` |
| GET | `/submit` | 否 | 返回客户需求提交页面 |
| GET | `/submit-success` | 否 | 返回提交成功详情页面，通过 URL `orderNo` 和 `sessionStorage` 展示本次提交结果 |
| GET | `/submit-success.html` | 否 | 返回提交成功详情页面，兼容带 `.html` 的访问路径 |
| GET | `/admin/login` | 否 | 返回后台登录页面；已登录时跳转 `/admin` |
| GET | `/admin` | 是 | 返回后台订单列表页面 |
| GET | `/admin/orders/:id` | 是 | 返回后台订单详情页面 |
| GET | `/admin/logout` | 否 | 销毁 session，清除 cookie，跳转 `/admin/login` |

静态资源路由：

| 路径前缀 | 对应目录 |
| --- | --- |
| `/css` | `public/css` |
| `/js` | `public/js` |

## 4. 订单提交相关接口

### 4.1 提交订单

| 项目 | 当前实现 |
| --- | --- |
| 方法 | POST |
| 路径 | `/api/orders` |
| 登录要求 | 否 |
| 请求类型 | `multipart/form-data` |
| 前端调用位置 | `public/js/main.js` 的提交页逻辑 |

### 4.2 提交字段

| 字段名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `customer_name` | string | 是 | 姓名或昵称 |
| `contact` | string | 是 | 联系方式 |
| `task_type` | string | 是 | 必须属于当前任务类型枚举 |
| `deadline` | string | 是 | 前端为 `datetime-local` 值，例如 `2026-07-10T18:30` |
| `requirement` | string | 是 | 具体需求 |
| `extra_note` | string | 否 | 附加备注 |
| `materials` | file[] | 否 | 上传材料，支持多文件 |

当前任务类型枚举：

1. 课设报告
2. 实验报告
3. PPT制作
4. 代码作业
5. 论文/文档
6. 其他

### 4.3 文件上传字段与限制

文件字段名为：

- `materials`

当前使用 `upload.array('materials')` 接收多个文件。上传材料不是必填项，客户可以不上传文件直接提交需求。

支持扩展名：

- `.doc`
- `.docx`
- `.pdf`
- `.xls`
- `.xlsx`
- `.ppt`
- `.pptx`
- `.zip`
- `.rar`
- `.png`
- `.jpg`
- `.jpeg`

单个文件最大 100MB。文件扩展名由后端 `config.allowedExtensionSet` 校验，超大文件由 multer 的 `fileSize` 限制拦截。

### 4.4 成功返回

提交成功时返回 JSON：

```json
{
  "success": true,
  "message": "需求提交成功",
  "orderNo": "DD20260707001",
  "data": {
    "order_no": "DD20260707001",
    "task_type": "PPT制作",
    "contact": "客户联系方式",
    "deadline": "2026-07-10T18:30",
    "created_at": "2026-07-07T06:30:00.000Z",
    "status": "未处理"
  }
}
```

兼容说明：

1. 顶层 `orderNo` 保留，用于兼容已有前端或脚本。
2. `data` 为 V1.2.1 新增字段，用于提交成功详情页展示本次提交的核心信息。
3. 前端提交成功后会把 `data` 暂存到 `sessionStorage`，并跳转到 `/submit-success?orderNo=订单号`。
4. 成功页不会调用新的客户查询接口；如果刷新或缺少 `sessionStorage`，页面至少展示 URL 中的订单号和兜底提示。

### 4.5 失败返回

提交失败时返回 JSON，HTTP 状态码通常为 400 或 500：

```json
{
  "success": false,
  "message": "错误提示"
}
```

当前已实现的典型失败提示包括：

1. 请填写姓名或昵称。
2. 请填写联系方式。
3. 请选择任务类型。
4. 请选择截止时间。
5. 请填写具体需求。
6. 任务类型不正确。
7. 单个文件不能超过 100MB。
8. 不支持的文件格式。
9. 提交失败，请稍后重试。

如果校验失败且已有文件被 multer 暂存，后端会尝试清理本次请求上传的文件。

## 5. 后台登录相关接口

### 5.1 登录页面

| 方法 | 路径 | 当前行为 |
| --- | --- | --- |
| GET | `/admin/login` | 返回后台登录页面；已登录时重定向到 `/admin` |

### 5.2 登录提交

| 项目 | 当前实现 |
| --- | --- |
| 方法 | POST |
| 路径 | `/admin/login` |
| 登录要求 | 否 |
| 请求类型 | 当前前端使用 `application/json` |

请求体：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

成功返回：

```json
{
  "success": true
}
```

登录成功后，前端跳转到 `/admin`。

失败返回：

```json
{
  "success": false,
  "message": "账号或密码不正确。"
}
```

失败状态码为 401。

### 5.3 退出登录

| 方法 | 路径 | 当前行为 |
| --- | --- | --- |
| GET | `/admin/logout` | 销毁 session，清除 `crmvp.sid` cookie，重定向到 `/admin/login` |

### 5.4 登录保护规则

当前后台保护基于 `express-session`：

1. 登录成功后设置 `req.session.isAdmin = true`。
2. session cookie 名称为 `crmvp.sid`。
3. cookie 当前配置为 `httpOnly: true`、`sameSite: 'lax'`。
4. cookie 有效期为 8 小时。
5. 未登录访问后台 HTML 页面会重定向到 `/admin/login`。
6. 未登录访问 `/api/` 开头的后台接口会返回 401 JSON。

## 6. 后台订单相关接口

### 6.1 订单列表页面

| 方法 | 路径 | 登录要求 | 当前行为 |
| --- | --- | --- | --- |
| GET | `/admin` | 是 | 返回后台订单列表 HTML |

`/admin` 列表页支持以下 query 参数，并由前端转发给 `/api/admin/orders` 获取数据：

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `keyword` | 模糊搜索订单编号、客户姓名、联系方式、具体需求 | 空 |
| `status` | 状态筛选：未处理、处理中、已完成、已取消 | 全部 |
| `taskType` | 任务类型筛选：课设报告、实验报告、PPT制作、代码作业、论文/文档、其他 | 全部 |
| `page` | 当前页码，超出范围时自动回到合理页码 | `1` |
| `pageSize` | 每页数量，仅支持 `10`、`20`、`50` | `10` |
| `sortBy` | 排序字段，仅支持 `created_at`、`deadline` | `created_at` |
| `sortOrder` | 排序方向，仅支持 `asc`、`desc` | `desc` |

### 6.2 获取订单列表数据

| 项目 | 当前实现 |
| --- | --- |
| 方法 | GET |
| 路径 | `/api/admin/orders` |
| 登录要求 | 是 |

成功返回：

```json
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "order_no": "DD20260707001",
      "customer_name": "客户姓名",
      "contact": "联系方式",
      "task_type": "PPT制作",
      "deadline": "2026-07-10T18:30",
      "status": "未处理",
      "created_at": "2026-07-07T06:30:00.000Z",
      "updated_at": "2026-07-07T06:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  },
  "filters": {
    "keyword": "",
    "status": "",
    "taskType": ""
  },
  "sort": {
    "sortBy": "created_at",
    "sortOrder": "desc"
  }
}
```

默认排序规则：

1. `datetime(created_at) DESC`
2. `id DESC`

筛选和搜索使用参数绑定。`sortBy` 和 `sortOrder` 只接受白名单值，避免将用户输入直接拼接进排序 SQL。

### 6.3 订单详情页面

| 方法 | 路径 | 登录要求 | 当前行为 |
| --- | --- | --- | --- |
| GET | `/admin/orders/:id` | 是 | 返回后台订单详情 HTML |

### 6.4 获取订单详情数据

| 项目 | 当前实现 |
| --- | --- |
| 方法 | GET |
| 路径 | `/api/admin/orders/:id` |
| 登录要求 | 是 |

成功返回：

```json
{
  "success": true,
  "order": {
    "id": 1,
    "order_no": "DD20260707001",
    "customer_name": "客户姓名",
    "contact": "联系方式",
    "task_type": "PPT制作",
    "deadline": "2026-07-10T18:30",
    "requirement": "具体需求",
    "extra_note": "附加备注",
    "status": "未处理",
    "internal_note": "",
    "created_at": "2026-07-07T06:30:00.000Z",
    "updated_at": "2026-07-07T06:30:00.000Z"
  },
  "files": [
    {
      "id": 1,
      "order_id": 1,
      "original_name": "需求说明.pdf",
      "stored_name": "1783406734333-79cb5f81e22acce4.pdf",
      "file_path": "uploads/1783406734333-79cb5f81e22acce4.pdf",
      "mime_type": "application/pdf",
      "size": 12345,
      "created_at": "2026-07-07T06:30:00.000Z"
    }
  ]
}
```

订单不存在时返回 404：

```json
{
  "success": false,
  "message": "订单不存在。"
}
```

### 6.5 状态修改和内部备注修改

| 项目 | 当前实现 |
| --- | --- |
| 方法 | PATCH |
| 路径 | `/api/admin/orders/:id` |
| 登录要求 | 是 |
| 请求类型 | 当前前端使用 `application/json` |

请求体：

```json
{
  "status": "处理中",
  "internal_note": "仅后台可见的备注"
}
```

当前允许修改的字段只有：

1. `status`
2. `internal_note`

当前状态枚举：

1. 未处理
2. 处理中
3. 已完成
4. 已取消

成功返回：

```json
{
  "success": true,
  "order": {
    "id": 1,
    "order_no": "DD20260707001",
    "status": "处理中",
    "internal_note": "仅后台可见的备注"
  }
}
```

实际返回的 `order` 为数据库中的完整订单记录。

失败情况：

1. 状态不在枚举内时，返回 400 和 `订单状态不正确。`
2. 订单不存在时，返回 404 和 `订单不存在。`
3. 未登录时，返回 401 和 `请先登录后台。`

## 7. 文件下载相关接口

### 7.1 下载路径

| 方法 | 路径 | 登录要求 | 当前行为 |
| --- | --- | --- | --- |
| GET | `/admin/files/:id/download` | 是 | 下载指定文件 |

### 7.2 权限要求

文件下载必须管理员已登录。未登录访问会被重定向到 `/admin/login`。

### 7.3 文件定位方式

当前下载逻辑：

1. 根据 `files.id` 查询文件记录，并关联 `orders.order_no`。
2. 使用 `config.uploadsDir` 和 `files.stored_name` 拼接本地绝对路径。
3. 如果数据库记录不存在，返回 404：`文件不存在。`
4. 如果本地文件不存在，返回 404：`文件已不存在。`
5. 使用 Express `res.download(absolutePath, file.original_name)` 下载。

### 7.4 原始文件名处理方式

上传时服务端会尝试修复中文文件名编码，数据库保存：

1. `original_name`：客户上传时的原始文件名，下载时尽量使用。
2. `stored_name`：服务端生成的本地存储文件名，格式为时间戳加随机字符串加原扩展名。

## 8. 通用错误规则

当前代码中的兜底行为：

1. 未匹配的 `/api/` 路径返回 404 JSON：`接口不存在。`
2. 未匹配的页面路径返回 404 文本：`页面不存在。`
3. 未捕获服务端错误返回 500 JSON：`服务器内部错误。`

## 9. 后续新增接口规范

后续新增或修改接口时必须遵守：

1. 新接口必须先写入 `API_CONTRACT.md`。
2. 前端和后端都必须按本文档实现。
3. 修改已有接口路径、方法、字段、返回结构或错误码时，必须同步更新本文档。
4. 测试会话验收时以本文档为准。
5. 不要在未更新文档的情况下改变现有页面路径。
6. 不要把当前服务端渲染 HTML + fetch JSON 的结构强行改成前后端分离，除非新版本计划明确要求。
7. 新增后台接口默认必须接入管理员登录保护。
8. 新增客户侧接口必须明确是否需要登录；当前客户侧默认无登录。
