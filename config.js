const path = require('path');
require('dotenv').config();

const rootDir = __dirname;

const allowedExtensions = [
  '.doc',
  '.docx',
  '.pdf',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
];

module.exports = {
  port: Number(process.env.PORT || 3000),
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(rootDir, 'uploads'),
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(rootDir, 'data', 'database.sqlite'),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  sessionSecret:
    process.env.SESSION_SECRET || 'customer-requirement-mvp-change-this-secret',
  maxFileSize: 100 * 1024 * 1024,
  allowedExtensions,
  allowedExtensionSet: new Set(allowedExtensions),
  taskTypes: ['课设报告', '实验报告', 'PPT制作', '代码作业', '论文/文档', '其他'],
  statuses: ['未处理', '处理中', '已完成', '已取消'],
};
