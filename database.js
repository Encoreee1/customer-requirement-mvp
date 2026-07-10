const crypto = require('crypto');
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

  CREATE TABLE IF NOT EXISTS order_supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    supplement_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_supplement_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplement_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (supplement_id) REFERENCES order_supplements(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    delivery_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_delivery_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL UNIQUE,
    download_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (delivery_id) REFERENCES order_deliveries(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_files_order_id ON files(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_supplements_order_id
    ON order_supplements(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_supplement_files_supplement_id
    ON order_supplement_files(supplement_id);
  CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id
    ON order_deliveries(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_delivery_files_delivery_id
    ON order_delivery_files(delivery_id);
  CREATE INDEX IF NOT EXISTS idx_order_delivery_files_download_token
    ON order_delivery_files(download_token);
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

const insertSupplement = db.prepare(`
  INSERT INTO order_supplements (
    order_id,
    supplement_note,
    created_at
  ) VALUES (
    @order_id,
    @supplement_note,
    @created_at
  )
`);

const insertSupplementFile = db.prepare(`
  INSERT INTO order_supplement_files (
    supplement_id,
    file_id,
    created_at
  ) VALUES (
    @supplement_id,
    @file_id,
    @created_at
  )
`);

const insertDelivery = db.prepare(`
  INSERT INTO order_deliveries (
    order_id,
    delivery_note,
    created_at,
    updated_at
  ) VALUES (
    @order_id,
    @delivery_note,
    @created_at,
    @updated_at
  )
`);

const insertDeliveryFile = db.prepare(`
  INSERT INTO order_delivery_files (
    delivery_id,
    file_id,
    download_token,
    created_at
  ) VALUES (
    @delivery_id,
    @file_id,
    @download_token,
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

function insertUploadedFile(orderId, file, timestamp) {
  const fileInfo = insertFile.run({
    order_id: orderId,
    original_name: normalizeOriginalName(file.originalname),
    stored_name: file.filename,
    file_path: path.posix.join('uploads', file.filename),
    mime_type: file.mimetype || '',
    size: file.size,
    created_at: timestamp,
  });

  return Number(fileInfo.lastInsertRowid);
}

function createDownloadToken() {
  return crypto.randomBytes(32).toString('hex');
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
    insertUploadedFile(orderId, file, timestamp);
  }

  return { id: orderId, orderNo, createdAt: timestamp, status: defaultStatus };
});

function createOrder(orderData, uploadedFiles) {
  return createOrderTransaction(orderData, uploadedFiles);
}

const createOrderSupplementTransaction = db.transaction(
  (orderNo, contact, supplementNote, uploadedFiles) => {
    const order = db
      .prepare(
        `
          SELECT id, order_no
          FROM orders
          WHERE order_no = @order_no
            AND contact = @contact
          LIMIT 1
        `
      )
      .get({
        order_no: orderNo,
        contact,
      });

    if (!order) {
      return null;
    }

    const timestamp = nowIso();
    const files = uploadedFiles || [];
    const supplementInfo = insertSupplement.run({
      order_id: order.id,
      supplement_note: supplementNote || '',
      created_at: timestamp,
    });
    const supplementId = Number(supplementInfo.lastInsertRowid);

    for (const file of files) {
      const fileId = insertUploadedFile(order.id, file, timestamp);
      insertSupplementFile.run({
        supplement_id: supplementId,
        file_id: fileId,
        created_at: timestamp,
      });
    }

    return {
      orderNo: order.order_no,
      fileCount: files.length,
      hasNote: Boolean((supplementNote || '').trim()),
      createdAt: timestamp,
    };
  }
);

function createOrderSupplement(orderNo, contact, supplementNote, uploadedFiles) {
  return createOrderSupplementTransaction(
    orderNo,
    contact,
    supplementNote,
    uploadedFiles
  );
}

const createOrderDeliveryTransaction = db.transaction(
  (orderId, deliveryNote, uploadedFiles) => {
    const order = db
      .prepare(
        `
          SELECT id, order_no
          FROM orders
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(orderId);

    if (!order) {
      return null;
    }

    const timestamp = nowIso();
    const files = uploadedFiles || [];
    const deliveryInfo = insertDelivery.run({
      order_id: order.id,
      delivery_note: deliveryNote || '',
      created_at: timestamp,
      updated_at: timestamp,
    });
    const deliveryId = Number(deliveryInfo.lastInsertRowid);

    for (const file of files) {
      const fileId = insertUploadedFile(order.id, file, timestamp);
      insertDeliveryFile.run({
        delivery_id: deliveryId,
        file_id: fileId,
        download_token: createDownloadToken(),
        created_at: timestamp,
      });
    }

    return {
      orderNo: order.order_no,
      fileCount: files.length,
      hasNote: Boolean((deliveryNote || '').trim()),
      createdAt: timestamp,
    };
  }
);

function createOrderDelivery(orderId, deliveryNote, uploadedFiles) {
  return createOrderDeliveryTransaction(orderId, deliveryNote, uploadedFiles);
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
    .prepare(
      `
        SELECT files.*
        FROM files
        LEFT JOIN order_supplement_files
          ON order_supplement_files.file_id = files.id
        LEFT JOIN order_delivery_files
          ON order_delivery_files.file_id = files.id
        WHERE files.order_id = ?
          AND order_supplement_files.file_id IS NULL
          AND order_delivery_files.file_id IS NULL
        ORDER BY files.id ASC
      `
    )
    .all(orderId);
}

function getSupplementsByOrderId(orderId) {
  const supplements = db
    .prepare(
      `
        SELECT id, supplement_note, created_at
        FROM order_supplements
        WHERE order_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
      `
    )
    .all(orderId);

  if (!supplements.length) {
    return [];
  }

  const ids = supplements.map((supplement) => supplement.id);
  const placeholders = ids.map(() => '?').join(', ');
  const files = db
    .prepare(
      `
        SELECT
          order_supplement_files.supplement_id,
          files.id,
          files.original_name,
          files.mime_type,
          files.size,
          files.created_at
        FROM order_supplement_files
        JOIN files ON files.id = order_supplement_files.file_id
        WHERE order_supplement_files.supplement_id IN (${placeholders})
        ORDER BY order_supplement_files.id ASC
      `
    )
    .all(...ids);

  const filesBySupplement = new Map();
  for (const file of files) {
    const supplementId = file.supplement_id;
    if (!filesBySupplement.has(supplementId)) {
      filesBySupplement.set(supplementId, []);
    }
    filesBySupplement.get(supplementId).push({
      id: file.id,
      original_name: file.original_name,
      mime_type: file.mime_type,
      size: file.size,
      created_at: file.created_at,
    });
  }

  return supplements.map((supplement) => ({
    id: supplement.id,
    supplement_note: supplement.supplement_note,
    created_at: supplement.created_at,
    files: filesBySupplement.get(supplement.id) || [],
  }));
}

function getDeliveriesByOrderId(orderId) {
  const deliveries = db
    .prepare(
      `
        SELECT id, delivery_note, created_at, updated_at
        FROM order_deliveries
        WHERE order_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
      `
    )
    .all(orderId);

  if (!deliveries.length) {
    return [];
  }

  const ids = deliveries.map((delivery) => delivery.id);
  const placeholders = ids.map(() => '?').join(', ');
  const files = db
    .prepare(
      `
        SELECT
          order_delivery_files.delivery_id,
          files.id,
          files.original_name,
          files.mime_type,
          files.size,
          files.created_at
        FROM order_delivery_files
        JOIN files ON files.id = order_delivery_files.file_id
        WHERE order_delivery_files.delivery_id IN (${placeholders})
        ORDER BY order_delivery_files.id ASC
      `
    )
    .all(...ids);

  const filesByDelivery = new Map();
  for (const file of files) {
    const deliveryId = file.delivery_id;
    if (!filesByDelivery.has(deliveryId)) {
      filesByDelivery.set(deliveryId, []);
    }
    filesByDelivery.get(deliveryId).push({
      id: file.id,
      original_name: file.original_name,
      mime_type: file.mime_type,
      size: file.size,
      created_at: file.created_at,
      download_url: `/admin/files/${file.id}/download`,
    });
  }

  return deliveries.map((delivery) => ({
    id: delivery.id,
    delivery_note: delivery.delivery_note,
    created_at: delivery.created_at,
    updated_at: delivery.updated_at,
    files: filesByDelivery.get(delivery.id) || [],
  }));
}

function getOrderWithFiles(orderId) {
  const order = getOrderById(orderId);
  if (!order) {
    return null;
  }

  return {
    order,
    files: getFilesByOrderId(orderId),
    supplements: getSupplementsByOrderId(orderId),
    deliveries: getDeliveriesByOrderId(orderId),
  };
}

function getCustomerVisibleDeliveries(orderId) {
  const deliveries = db
    .prepare(
      `
        SELECT id, delivery_note, created_at
        FROM order_deliveries
        WHERE order_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
      `
    )
    .all(orderId);

  if (!deliveries.length) {
    return [];
  }

  const ids = deliveries.map((delivery) => delivery.id);
  const placeholders = ids.map(() => '?').join(', ');
  const files = db
    .prepare(
      `
        SELECT
          order_delivery_files.delivery_id,
          order_delivery_files.download_token,
          files.original_name,
          files.size
        FROM order_delivery_files
        JOIN files ON files.id = order_delivery_files.file_id
        WHERE order_delivery_files.delivery_id IN (${placeholders})
        ORDER BY order_delivery_files.id ASC
      `
    )
    .all(...ids);

  const filesByDelivery = new Map();
  for (const file of files) {
    const deliveryId = file.delivery_id;
    if (!filesByDelivery.has(deliveryId)) {
      filesByDelivery.set(deliveryId, []);
    }
    filesByDelivery.get(deliveryId).push({
      original_name: file.original_name,
      size: file.size,
      download_token: file.download_token,
    });
  }

  return deliveries.map((delivery) => ({
    delivery_note: delivery.delivery_note,
    created_at: delivery.created_at,
    files: filesByDelivery.get(delivery.id) || [],
  }));
}

function getCustomerVisibleOrder(orderNo, contact) {
  const order = db
    .prepare(
      `
        SELECT
          id,
          order_no,
          task_type,
          contact,
          deadline,
          created_at,
          status,
          requirement,
          (
            SELECT COUNT(*)
            FROM files
            LEFT JOIN order_supplement_files
              ON order_supplement_files.file_id = files.id
            LEFT JOIN order_delivery_files
              ON order_delivery_files.file_id = files.id
            WHERE files.order_id = orders.id
              AND order_supplement_files.file_id IS NULL
              AND order_delivery_files.file_id IS NULL
          ) AS file_count
        FROM orders
        WHERE order_no = @order_no
          AND contact = @contact
        LIMIT 1
      `
    )
    .get({
      order_no: orderNo,
      contact,
    });

  if (!order) {
    return null;
  }

  const requirement =
    typeof order.requirement === 'string' ? order.requirement.trim() : '';
  const requirementSummary =
    requirement.length > 120 ? `${requirement.slice(0, 120)}...` : requirement;

  return {
    order_no: order.order_no,
    task_type: order.task_type,
    contact: order.contact,
    deadline: order.deadline,
    created_at: order.created_at,
    status: order.status,
    status_label: order.status,
    requirement_summary: requirementSummary,
    file_count: Number(order.file_count || 0),
    deliveries: getCustomerVisibleDeliveries(order.id),
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

function getCustomerDeliveryDownloadFile(orderNo, contact, downloadToken) {
  return db
    .prepare(
      `
        SELECT
          files.original_name,
          files.stored_name,
          files.size,
          files.mime_type
        FROM order_delivery_files
        JOIN order_deliveries
          ON order_deliveries.id = order_delivery_files.delivery_id
        JOIN orders
          ON orders.id = order_deliveries.order_id
        JOIN files
          ON files.id = order_delivery_files.file_id
        LEFT JOIN order_supplement_files
          ON order_supplement_files.file_id = files.id
        WHERE orders.order_no = @order_no
          AND orders.contact = @contact
          AND order_delivery_files.download_token = @download_token
          AND files.order_id = orders.id
          AND order_supplement_files.file_id IS NULL
        LIMIT 1
      `
    )
    .get({
      order_no: orderNo,
      contact,
      download_token: downloadToken,
    });
}

module.exports = {
  createOrder,
  createOrderSupplement,
  createOrderDelivery,
  getOrders,
  getOrderWithFiles,
  getCustomerVisibleOrder,
  getCustomerDeliveryDownloadFile,
  updateOrder,
  getFileById,
};
