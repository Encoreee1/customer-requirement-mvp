const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    contact TEXT NOT NULL,
    task_type TEXT NOT NULL,
    deadline TEXT NOT NULL,
    requirement TEXT NOT NULL,
    extra_note TEXT,
    status TEXT NOT NULL DEFAULT '未处理',
    internal_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_files_order_id ON files(order_id);
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (
    order_no,
    customer_name,
    contact,
    task_type,
    deadline,
    requirement,
    extra_note,
    status,
    internal_note,
    created_at,
    updated_at
  ) VALUES (
    @order_no,
    @customer_name,
    @contact,
    @task_type,
    @deadline,
    @requirement,
    @extra_note,
    @status,
    @internal_note,
    @created_at,
    @updated_at
  )
`);

const insertFile = db.prepare(`
  INSERT INTO files (
    order_id,
    original_name,
    stored_name,
    file_path,
    mime_type,
    size,
    created_at
  ) VALUES (
    @order_id,
    @original_name,
    @stored_name,
    @file_path,
    @mime_type,
    @size,
    @created_at
  )
`);

function nowIso() {
  return new Date().toISOString();
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeOriginalName(originalName) {
  if (!originalName) {
    return '';
  }

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  if (decoded && !decoded.includes('�') && /[\u4e00-\u9fff]/.test(decoded)) {
    return decoded;
  }

  return originalName;
}

function nextOrderNo() {
  const prefix = `DD${formatDateKey()}`;
  const latest = db
    .prepare(
      'SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1'
    )
    .get(`${prefix}%`);

  const nextSeq = latest ? Number(latest.order_no.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

const createOrderTransaction = db.transaction((orderData, uploadedFiles) => {
  const timestamp = nowIso();
  const orderNo = nextOrderNo();
  const defaultStatus = '未处理';
  const orderInfo = insertOrder.run({
    order_no: orderNo,
    customer_name: orderData.customer_name,
    contact: orderData.contact,
    task_type: orderData.task_type,
    deadline: orderData.deadline,
    requirement: orderData.requirement,
    extra_note: orderData.extra_note || '',
    status: defaultStatus,
    internal_note: '',
    created_at: timestamp,
    updated_at: timestamp,
  });

  const orderId = Number(orderInfo.lastInsertRowid);
  for (const file of uploadedFiles) {
    insertFile.run({
      order_id: orderId,
      original_name: normalizeOriginalName(file.originalname),
      stored_name: file.filename,
      file_path: path.posix.join('uploads', file.filename),
      mime_type: file.mimetype || '',
      size: file.size,
      created_at: timestamp,
    });
  }

  return { id: orderId, orderNo, createdAt: timestamp, status: defaultStatus };
});

function createOrder(orderData, uploadedFiles) {
  return createOrderTransaction(orderData, uploadedFiles);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeListOptions(options = {}) {
  const pageSizeOptions = [10, 20, 50];
  const sortColumns = {
    created_at: 'datetime(created_at)',
    deadline: 'datetime(deadline)',
  };

  const pageSize = pageSizeOptions.includes(Number(options.pageSize))
    ? Number(options.pageSize)
    : 10;
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const sortBy = Object.hasOwn(sortColumns, options.sortBy)
    ? options.sortBy
    : 'created_at';
  const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    keyword: typeof options.keyword === 'string' ? options.keyword.trim() : '',
    status: config.statuses.includes(options.status) ? options.status : '',
    taskType: config.taskTypes.includes(options.taskType) ? options.taskType : '',
    page,
    pageSize,
    sortBy,
    sortOrder,
    sortColumn: sortColumns[sortBy],
  };
}

function buildOrderListWhere(options) {
  const clauses = [];
  const params = {};

  if (options.keyword) {
    params.keyword = `%${escapeLike(options.keyword)}%`;
    clauses.push(`(
      order_no LIKE @keyword ESCAPE '\\'
      OR customer_name LIKE @keyword ESCAPE '\\'
      OR contact LIKE @keyword ESCAPE '\\'
      OR requirement LIKE @keyword ESCAPE '\\'
    )`);
  }

  if (options.status) {
    params.status = options.status;
    clauses.push('status = @status');
  }

  if (options.taskType) {
    params.taskType = options.taskType;
    clauses.push('task_type = @taskType');
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function getOrders(options = {}) {
  const normalized = normalizeListOptions(options);
  const { whereSql, params } = buildOrderListWhere(normalized);
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM orders ${whereSql}`)
    .get(params);
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / normalized.pageSize));
  const page = Math.min(normalized.page, totalPages);
  const offset = (page - 1) * normalized.pageSize;
  const direction = normalized.sortOrder.toUpperCase();

  const orders = db
    .prepare(
      `
        SELECT
          id,
          order_no,
          customer_name,
          contact,
          task_type,
          deadline,
          status,
          created_at,
          updated_at
        FROM orders
        ${whereSql}
        ORDER BY ${normalized.sortColumn} ${direction}, id ${direction}
        LIMIT @limit OFFSET @offset
      `
    )
    .all({
      ...params,
      limit: normalized.pageSize,
      offset,
    });

  return {
    orders,
    pagination: {
      total,
      page,
      pageSize: normalized.pageSize,
      totalPages,
    },
    filters: {
      keyword: normalized.keyword,
      status: normalized.status,
      taskType: normalized.taskType,
    },
    sort: {
      sortBy: normalized.sortBy,
      sortOrder: normalized.sortOrder,
    },
  };
}

function getOrderById(orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

function getFilesByOrderId(orderId) {
  return db
    .prepare('SELECT * FROM files WHERE order_id = ? ORDER BY id ASC')
    .all(orderId);
}

function getOrderWithFiles(orderId) {
  const order = getOrderById(orderId);
  if (!order) {
    return null;
  }

  return {
    order,
    files: getFilesByOrderId(orderId),
  };
}

function updateOrder(orderId, data) {
  const timestamp = nowIso();
  const result = db
    .prepare(
      `
        UPDATE orders
        SET status = @status,
            internal_note = @internal_note,
            updated_at = @updated_at
        WHERE id = @id
      `
    )
    .run({
      id: orderId,
      status: data.status,
      internal_note: data.internal_note || '',
      updated_at: timestamp,
    });

  if (result.changes === 0) {
    return null;
  }

  return getOrderById(orderId);
}

function getFileById(fileId) {
  return db
    .prepare(
      `
        SELECT
          files.*,
          orders.order_no
        FROM files
        JOIN orders ON orders.id = files.order_id
        WHERE files.id = ?
      `
    )
    .get(fileId);
}

module.exports = {
  createOrder,
  getOrders,
  getOrderWithFiles,
  updateOrder,
  getFileById,
};
