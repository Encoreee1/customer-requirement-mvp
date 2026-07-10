const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const config = require('./config');
const database = require('./database');

const app = express();

fs.mkdirSync(config.uploadsDir, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    name: 'crmvp.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensionSet.has(ext)) {
      const error = new Error(
        `不支持的文件格式：${ext || '无扩展名'}。支持格式：${config.allowedExtensions.join(', ')}`
      );
      error.code = 'UNSUPPORTED_FILE_TYPE';
      cb(error);
      return;
    }

    cb(null, true);
  },
});

function viewPath(fileName) {
  return path.join(__dirname, 'views', fileName);
}

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    fs.unlink(file.path, () => {});
  }
}

function normalizeOriginalName(originalName) {
  if (!originalName) {
    return '';
  }

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  const looksMojibake = /[ÃÂâäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(
    originalName
  );
  const decodedHasCjk = /[\u4e00-\u9fff]/.test(decoded);

  if (decoded && !decoded.includes('�') && (looksMojibake || decodedHasCjk)) {
    return decoded;
  }

  return originalName;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const customerOrderNotFoundMessage = '未查询到订单，请确认订单号和联系方式是否正确。';
const customerDeliveryDownloadNotFoundMessage =
  '未找到可下载的成品文件，请确认订单号和联系方式是否正确。';

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
    return;
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({ success: false, message: '请先登录后台。' });
    return;
  }

  res.redirect('/admin/login');
}

function uploadMiddleware(req, res, next) {
  upload.array('materials')(req, res, (error) => {
    if (!error) {
      for (const file of req.files || []) {
        file.originalname = normalizeOriginalName(file.originalname);
      }
      next();
      return;
    }

    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? '单个文件不能超过 100MB。'
        : error.message || '上传失败，请检查文件格式和大小。';

    cleanupUploadedFiles(req.files);
    res.status(400).json({ success: false, message });
  });
}

app.get('/', (_req, res) => {
  res.redirect('/submit');
});

app.get('/submit', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

function sendSubmitSuccessPage(_req, res) {
  res.sendFile(path.join(__dirname, 'public', 'submit-success.html'));
}

app.get('/submit-success', sendSubmitSuccessPage);
app.get('/submit-success.html', sendSubmitSuccessPage);

function sendOrderQueryPage(_req, res) {
  res.sendFile(path.join(__dirname, 'public', 'order-query.html'));
}

app.get('/order-query', sendOrderQueryPage);
app.get('/order-query.html', sendOrderQueryPage);

function sendSupplementUploadPage(_req, res) {
  res.sendFile(path.join(__dirname, 'public', 'supplement-upload.html'));
}

app.get('/supplement-upload', sendSupplementUploadPage);
app.get('/supplement-upload.html', sendSupplementUploadPage);

app.post('/api/orders', uploadMiddleware, (req, res) => {
  const orderData = {
    customer_name: trimText(req.body.customer_name),
    contact: trimText(req.body.contact),
    task_type: trimText(req.body.task_type),
    deadline: trimText(req.body.deadline),
    requirement: trimText(req.body.requirement),
    extra_note: trimText(req.body.extra_note),
  };

  const requiredFields = [
    ['customer_name', '请填写姓名或昵称。'],
    ['contact', '请填写联系方式。'],
    ['task_type', '请选择任务类型。'],
    ['deadline', '请选择截止时间。'],
    ['requirement', '请填写具体需求。'],
  ];

  for (const [field, message] of requiredFields) {
    if (!orderData[field]) {
      cleanupUploadedFiles(req.files);
      res.status(400).json({ success: false, message });
      return;
    }
  }

  if (!config.taskTypes.includes(orderData.task_type)) {
    cleanupUploadedFiles(req.files);
    res.status(400).json({ success: false, message: '任务类型不正确。' });
    return;
  }

  try {
    const uploadedFiles = (req.files || []).map((file) => ({
      ...file,
      originalname: normalizeOriginalName(file.originalname),
    }));
    const result = database.createOrder(orderData, uploadedFiles);
    res.json({
      success: true,
      message: '需求提交成功',
      orderNo: result.orderNo,
      data: {
        order_no: result.orderNo,
        task_type: orderData.task_type,
        contact: orderData.contact,
        deadline: orderData.deadline,
        created_at: result.createdAt,
        status: result.status,
      },
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error(error);
    res.status(500).json({ success: false, message: '提交失败，请稍后重试。' });
  }
});

app.post('/api/customer/orders/query', (req, res) => {
  const orderNo = trimText(req.body.order_no || req.body.orderNo);
  const contact = trimText(req.body.contact);

  if (!orderNo || !contact) {
    res.status(400).json({
      success: false,
      message: '请填写订单号和联系方式。',
    });
    return;
  }

  try {
    const order = database.getCustomerVisibleOrder(orderNo, contact);
    if (!order) {
      res.status(404).json({
        success: false,
        message: customerOrderNotFoundMessage,
      });
      return;
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '查询失败，请稍后重试。' });
  }
});

app.post('/api/customer/orders/supplements', uploadMiddleware, (req, res) => {
  const orderNo = trimText(req.body.order_no || req.body.orderNo);
  const contact = trimText(req.body.contact);
  const supplementNote = trimText(req.body.supplement_note);
  const uploadedFiles = (req.files || []).map((file) => ({
    ...file,
    originalname: normalizeOriginalName(file.originalname),
  }));

  if (!orderNo || !contact) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(400).json({
      success: false,
      message: '请填写订单号和联系方式。',
    });
    return;
  }

  if (!supplementNote && uploadedFiles.length === 0) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(400).json({
      success: false,
      message: '请填写补充说明或上传补充资料。',
    });
    return;
  }

  try {
    const result = database.createOrderSupplement(
      orderNo,
      contact,
      supplementNote,
      uploadedFiles
    );

    if (!result) {
      cleanupUploadedFiles(uploadedFiles);
      res.status(404).json({
        success: false,
        message: customerOrderNotFoundMessage,
      });
      return;
    }

    res.json({
      success: true,
      message: '补充资料上传成功',
      data: {
        order_no: result.orderNo,
        file_count: result.fileCount,
        has_note: result.hasNote,
        created_at: result.createdAt,
      },
    });
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    console.error(error);
    res.status(500).json({
      success: false,
      message: '补充资料上传失败，请稍后重试。',
    });
  }
});

app.post('/api/customer/orders/deliveries/download', (req, res) => {
  const orderNo = trimText(req.body.order_no || req.body.orderNo);
  const contact = trimText(req.body.contact);
  const downloadToken = trimText(req.body.download_token);

  if (!orderNo || !contact || !downloadToken) {
    res.status(400).json({
      success: false,
      message: '请填写订单号、联系方式和下载凭证。',
    });
    return;
  }

  try {
    const file = database.getCustomerDeliveryDownloadFile(
      orderNo,
      contact,
      downloadToken
    );

    if (!file) {
      res.status(404).json({
        success: false,
        message: customerDeliveryDownloadNotFoundMessage,
      });
      return;
    }

    const absolutePath = path.join(config.uploadsDir, file.stored_name);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({
        success: false,
        message: customerDeliveryDownloadNotFoundMessage,
      });
      return;
    }

    res.download(absolutePath, file.original_name);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: customerDeliveryDownloadNotFoundMessage,
    });
  }
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.redirect('/admin');
    return;
  }

  res.sendFile(viewPath('admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const username = trimText(req.body.username);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (username === config.admin.username && password === config.admin.password) {
    req.session.isAdmin = true;
    req.session.username = username;
    res.json({ success: true });
    return;
  }

  res.status(401).json({ success: false, message: '账号或密码不正确。' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('crmvp.sid');
    res.redirect('/admin/login');
  });
});

app.get('/admin', requireAdmin, (_req, res) => {
  res.sendFile(viewPath('admin-list.html'));
});

app.get('/admin/orders/:id', requireAdmin, (_req, res) => {
  res.sendFile(viewPath('admin-detail.html'));
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const result = database.getOrders({
    keyword: req.query.keyword,
    status: req.query.status,
    taskType: req.query.taskType,
    page: req.query.page,
    pageSize: req.query.pageSize,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  });

  res.json({ success: true, ...result });
});

app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const data = database.getOrderWithFiles(orderId);
  if (!data) {
    res.status(404).json({ success: false, message: '订单不存在。' });
    return;
  }

  res.json({ success: true, ...data });
});

app.post('/api/admin/orders/:id/deliveries', requireAdmin, uploadMiddleware, (req, res) => {
  const orderId = Number(req.params.id);
  const deliveryNote = trimText(req.body.delivery_note);
  const uploadedFiles = (req.files || []).map((file) => ({
    ...file,
    originalname: normalizeOriginalName(file.originalname),
  }));

  if (!Number.isInteger(orderId) || orderId < 1) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(404).json({ success: false, message: '订单不存在。' });
    return;
  }

  if (!deliveryNote && uploadedFiles.length === 0) {
    cleanupUploadedFiles(uploadedFiles);
    res.status(400).json({
      success: false,
      message: '请填写交付说明或上传成品文件。',
    });
    return;
  }

  try {
    const result = database.createOrderDelivery(orderId, deliveryNote, uploadedFiles);

    if (!result) {
      cleanupUploadedFiles(uploadedFiles);
      res.status(404).json({ success: false, message: '订单不存在。' });
      return;
    }

    res.json({
      success: true,
      message: '成品上传成功',
      data: {
        order_no: result.orderNo,
        file_count: result.fileCount,
        has_note: result.hasNote,
        created_at: result.createdAt,
      },
    });
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    console.error(error);
    res.status(500).json({
      success: false,
      message: '成品上传失败，请稍后重试。',
    });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const status = trimText(req.body.status);
  const internalNote = trimText(req.body.internal_note);

  if (!config.statuses.includes(status)) {
    res.status(400).json({ success: false, message: '订单状态不正确。' });
    return;
  }

  const updated = database.updateOrder(orderId, {
    status,
    internal_note: internalNote,
  });

  if (!updated) {
    res.status(404).json({ success: false, message: '订单不存在。' });
    return;
  }

  res.json({ success: true, order: updated });
});

app.get('/admin/files/:id/download', requireAdmin, (req, res) => {
  const file = database.getFileById(Number(req.params.id));
  if (!file) {
    res.status(404).send('文件不存在。');
    return;
  }

  const absolutePath = path.join(config.uploadsDir, file.stored_name);
  if (!fs.existsSync(absolutePath)) {
    res.status(404).send('文件已不存在。');
    return;
  }

  res.download(absolutePath, file.original_name);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, message: '接口不存在。' });
    return;
  }

  res.status(404).send('页面不存在。');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ success: false, message: '服务器内部错误。' });
});

app.listen(config.port, () => {
  console.log(`客户需求提交与后台管理 MVP 已启动：http://localhost:${config.port}`);
  console.log(`客户提交页：http://localhost:${config.port}/submit`);
  console.log(`客户订单查询页：http://localhost:${config.port}/order-query`);
  console.log(`客户补充资料上传页：http://localhost:${config.port}/supplement-upload`);
  console.log(`后台登录页：http://localhost:${config.port}/admin/login`);
});
