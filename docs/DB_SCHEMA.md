# 数据库结构说明

## 1. 文档目的

本文档记录当前 SQLite 数据库结构、字段含义、枚举值和数据库变更规范。当前结构以 `database.js` 中的初始化代码为准。

## 2. 数据库文件位置

当前实现：

- 默认数据库文件：`data/database.sqlite`
- 默认数据目录：`data/`
- 默认上传目录：`uploads/`

`config.js` 支持通过环境变量覆盖：

| 环境变量 | 说明 |
| --- | --- |
| `DB_PATH` | 覆盖 SQLite 数据库文件路径 |
| `UPLOADS_DIR` | 覆盖上传文件保存目录 |

当前 `.env.example` 中未列出 `DB_PATH` 和 `UPLOADS_DIR`，但代码已经支持。是否需要补充到示例文件，待确认。

## 3. 初始化行为

当前 `database.js` 初始化时会执行：

1. 创建 `data/` 目录。
2. 创建 `uploads/` 目录。
3. 打开 SQLite 数据库。
4. 设置 `journal_mode = WAL`。
5. 设置 `foreign_keys = ON`。
6. 如果不存在则创建 `orders` 表。
7. 如果不存在则创建 `files` 表。
8. 如果不存在则创建 `order_supplements` 表。
9. 如果不存在则创建 `order_supplement_files` 表。
10. 如果不存在则创建 `order_deliveries` 表。
11. 如果不存在则创建 `order_delivery_files` 表。
12. 如果不存在则创建索引。

当前没有独立迁移脚本。

## 4. orders 表结构

`orders` 表用于保存客户提交的需求订单。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 订单主键 |
| `order_no` | TEXT | 是 | 无 | 对外展示的订单编号，唯一 |
| `customer_name` | TEXT | 是 | 无 | 客户姓名或昵称 |
| `contact` | TEXT | 是 | 无 | 客户联系方式 |
| `task_type` | TEXT | 是 | 无 | 任务类型 |
| `deadline` | TEXT | 是 | 无 | 截止时间，当前保存前端 `datetime-local` 字符串 |
| `requirement` | TEXT | 是 | 无 | 具体需求 |
| `extra_note` | TEXT | 否 | 数据库无默认值，当前创建订单时写入空字符串 | 附加备注 |
| `status` | TEXT | 是 | `未处理` | 订单状态 |
| `internal_note` | TEXT | 否 | 数据库无默认值，当前创建订单时写入空字符串 | 后台内部备注 |
| `created_at` | TEXT | 是 | 无 | 创建时间，当前为 JavaScript ISO 字符串 |
| `updated_at` | TEXT | 是 | 无 | 更新时间，当前为 JavaScript ISO 字符串 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
order_no TEXT NOT NULL UNIQUE,
status TEXT NOT NULL DEFAULT '未处理'
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
```

## 5. files 表结构

`files` 表用于保存订单关联的上传文件信息。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 文件主键 |
| `order_id` | INTEGER | 是 | 无 | 所属订单 id |
| `original_name` | TEXT | 是 | 无 | 客户上传时的原始文件名 |
| `stored_name` | TEXT | 是 | 无 | 服务端保存到 uploads 目录的文件名 |
| `file_path` | TEXT | 是 | 无 | 相对文件路径，当前格式为 `uploads/<stored_name>` |
| `mime_type` | TEXT | 否 | 数据库无默认值，当前创建文件记录时可能写入空字符串 | 上传文件 MIME 类型 |
| `size` | INTEGER | 是 | 无 | 文件大小，单位为字节 |
| `created_at` | TEXT | 是 | 无 | 文件记录创建时间，当前为 JavaScript ISO 字符串 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
order_id INTEGER NOT NULL,
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_files_order_id ON files(order_id);
```

## 6. order_supplements 表结构

`order_supplements` 表用于保存客户对已有订单发起的每一次补充资料提交。补充说明不直接写入 `files` 表。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 补充记录主键 |
| `order_id` | INTEGER | 是 | 无 | 所属订单 id |
| `supplement_note` | TEXT | 是 | 空字符串 | 客户填写的补充说明 |
| `created_at` | TEXT | 是 | 无 | 补充记录创建时间，当前为 JavaScript ISO 字符串 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
order_id INTEGER NOT NULL,
supplement_note TEXT NOT NULL DEFAULT '',
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_order_supplements_order_id
ON order_supplements(order_id);
```

## 7. order_supplement_files 表结构

`order_supplement_files` 表用于把补充批次和 `files` 表中的文件记录关联起来。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 关联记录主键 |
| `supplement_id` | INTEGER | 是 | 无 | 所属补充记录 id |
| `file_id` | INTEGER | 是 | 无 | 关联的文件 id |
| `created_at` | TEXT | 是 | 无 | 关联记录创建时间，当前为 JavaScript ISO 字符串 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
supplement_id INTEGER NOT NULL,
file_id INTEGER NOT NULL UNIQUE,
FOREIGN KEY (supplement_id) REFERENCES order_supplements(id) ON DELETE CASCADE,
FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_order_supplement_files_supplement_id
ON order_supplement_files(supplement_id);
```

兼容策略：

1. 不修改旧 `orders` 表结构，旧订单数据不受影响。
2. 不修改旧 `files` 表结构，补充文件仍保存到 `files` 表。
3. 原始上传文件是没有出现在 `order_supplement_files` 中的 `files` 记录。
4. 补充上传文件通过 `order_supplement_files.file_id` 与补充批次关联。
5. 只有说明、没有文件的补充记录允许存在；既没有说明也没有文件的提交会被后端拒绝。

## 8. order_deliveries 表结构

`order_deliveries` 表用于保存管理员对已有订单发起的每一次成品交付批次。交付说明不直接写入 `files` 表。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 交付记录主键 |
| `order_id` | INTEGER | 是 | 无 | 所属订单 id |
| `delivery_note` | TEXT | 是 | 空字符串 | 管理员填写的交付说明 |
| `created_at` | TEXT | 是 | 无 | 交付记录创建时间，当前为 JavaScript ISO 字符串 |
| `updated_at` | TEXT | 是 | 无 | 交付记录更新时间，当前创建时与 `created_at` 一致 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
order_id INTEGER NOT NULL,
delivery_note TEXT NOT NULL DEFAULT '',
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id
ON order_deliveries(order_id);
```

## 9. order_delivery_files 表结构

`order_delivery_files` 表用于把成品交付批次和 `files` 表中的文件记录关联起来，并保存客户侧下载所需的不可枚举 token。

| 字段名 | 类型 | 是否必填 | 默认值 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | 自动生成 | 自增 | 关联记录主键 |
| `delivery_id` | INTEGER | 是 | 无 | 所属交付记录 id |
| `file_id` | INTEGER | 是 | 无 | 关联的文件 id |
| `download_token` | TEXT | 是 | 无 | 客户下载成品文件时使用的不可枚举令牌 |
| `created_at` | TEXT | 是 | 无 | 关联记录创建时间，当前为 JavaScript ISO 字符串 |

建表语句中的关键约束：

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
delivery_id INTEGER NOT NULL,
file_id INTEGER NOT NULL UNIQUE,
download_token TEXT NOT NULL UNIQUE,
FOREIGN KEY (delivery_id) REFERENCES order_deliveries(id) ON DELETE CASCADE,
FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
```

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_order_delivery_files_delivery_id
ON order_delivery_files(delivery_id);

CREATE INDEX IF NOT EXISTS idx_order_delivery_files_download_token
ON order_delivery_files(download_token);
```

兼容策略：

1. 不修改旧 `orders` 表结构，旧订单数据不受影响。
2. 不修改旧 `files` 表结构，成品文件仍保存到 `files` 表。
3. 原始上传文件是没有出现在 `order_supplement_files` 或 `order_delivery_files` 中的 `files` 记录。
4. 补充上传文件只通过 `order_supplement_files.file_id` 与补充批次关联。
5. 成品交付文件只通过 `order_delivery_files.file_id` 与交付批次关联。
6. 每个成品文件必须有一个唯一 `download_token`。
7. 只有说明、没有文件的交付记录允许存在；既没有说明也没有文件的提交会被后端拒绝。

## 10. 订单状态枚举值

当前订单状态枚举来自 `config.js`：

1. `未处理`
2. `处理中`
3. `已完成`
4. `已取消`

创建订单时，当前默认状态为：

- `未处理`

后台修改状态时，后端会校验状态必须属于上述枚举。

## 11. 任务类型枚举值

当前任务类型枚举来自 `config.js`：

1. `课设报告`
2. `实验报告`
3. `PPT制作`
4. `代码作业`
5. `论文/文档`
6. `其他`

客户提交订单时，后端会校验 `task_type` 必须属于上述枚举。

## 12. orders、files、补充资料表和成品交付表的关系

当前关系为：

1. 一个订单可以关联 0 个、1 个或多个上传文件。
2. 每个文件必须关联一个订单。
3. `files.order_id` 外键引用 `orders.id`。
4. 一个订单可以关联 0 个、1 个或多个补充记录。
5. 每个补充记录必须关联一个订单。
6. 一个补充记录可以关联 0 个、1 个或多个补充文件。
7. 每个补充文件仍在 `files` 表中保存一条文件记录。
8. `order_supplement_files` 通过 `supplement_id` 和 `file_id` 连接补充记录与文件记录。
9. 一个订单可以关联 0 个、1 个或多个成品交付记录。
10. 每个成品交付记录必须关联一个订单。
11. 一个成品交付记录可以关联 0 个、1 个或多个成品文件。
12. 每个成品文件仍在 `files` 表中保存一条文件记录。
13. `order_delivery_files` 通过 `delivery_id` 和 `file_id` 连接交付记录与文件记录，并保存 `download_token`。
14. 外键设置为 `ON DELETE CASCADE`。

文件分区策略：

1. 原始上传文件：`files` 中不存在于 `order_supplement_files` 和 `order_delivery_files` 的记录。
2. 客户补充资料文件：通过 `order_supplement_files` 关联到补充批次的记录。
3. 管理员成品交付文件：通过 `order_delivery_files` 关联到交付批次的记录。
4. 后台订单详情必须按“原始上传文件 / 客户补充资料 / 成品交付”分区展示。
5. 客户查询接口只返回成品交付文件的客户可见字段和 `download_token`，不返回内部 id、存储文件名或服务器路径。

当前系统没有实现订单删除功能，因此级联删除规则暂未在业务界面中触发。

## 13. 订单编号生成规则

当前订单编号由 `database.js` 中的 `nextOrderNo()` 生成：

1. 前缀为 `DD`。
2. 中间为当前本地日期，格式 `YYYYMMDD`。
3. 后缀为当天递增序号，至少 3 位，不足补 0。

示例：

- `DD20260707001`
- `DD20260707002`

当前实现通过查询当天最大 `order_no` 来生成下一编号。

## 14. 文件存储字段说明

上传文件在磁盘上不会使用原始文件名保存，而是使用：

```text
<时间戳>-<随机16位hex><原扩展名>
```

数据库字段含义：

1. `original_name` 用于展示和下载时的建议文件名。
2. `stored_name` 用于定位 uploads 目录中的真实文件。
3. `file_path` 当前保存相对路径，但下载接口实际使用 `config.uploadsDir + stored_name` 定位文件。

## 15. 数据库变更规范

后续数据库变更必须遵守：

1. 后续如果要新增字段，必须先在 `DB_SCHEMA.md` 中说明原因、字段名、类型、默认值和兼容策略。
2. 不允许随意删除旧字段。
3. 修改字段名时必须考虑历史数据兼容。
4. 修改枚举值时必须同步检查前端选项、后端校验、数据库历史值和测试清单。
5. 测试会话需要检查数据库初始化是否正常。
6. 如果后续需要迁移脚本，应单独记录迁移文件、执行方式、回滚方式和测试方法。
7. 不要直接手动改动生产或重要测试数据库文件；需要先备份。
8. 新增表或字段后，必须同步更新 `API_CONTRACT.md` 中相关接口返回结构。
