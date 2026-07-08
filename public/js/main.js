(function () {
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
  const maxFileSize = 100 * 1024 * 1024;
  const submitSuccessStorageKey = 'customerRequirementLastSubmitSuccess';

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'submit') initSubmitPage();
    if (page === 'submit-success') initSubmitSuccessPage();
    if (page === 'order-query') initOrderQueryPage();
    if (page === 'admin-login') initLoginPage();
    if (page === 'admin-list') initAdminListPage();
    if (page === 'admin-detail') initAdminDetailPage();
  });

  function setMessage(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = `message ${type ? `message-${type}` : ''}`;
  }

  async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.href = '/admin/login';
      return null;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return value.replace('T', ' ');
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  }

  function getFileExtension(name) {
    const dotIndex = name.lastIndexOf('.');
    return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
  }

  function validateFiles(fileInput) {
    const files = Array.from(fileInput.files || []);
    for (const file of files) {
      const ext = getFileExtension(file.name);
      if (!allowedExtensions.includes(ext)) {
        return `不支持的文件格式：${ext || '无扩展名'}。`;
      }
      if (file.size > maxFileSize) {
        return `文件“${file.name}”超过 100MB。`;
      }
    }
    return '';
  }

  function getFormValue(form, name) {
    const field = form.elements[name];
    return typeof field?.value === 'string' ? field.value.trim() : '';
  }

  function readSubmitSuccessData() {
    try {
      const raw = sessionStorage.getItem(submitSuccessStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSubmitSuccessData(data) {
    try {
      sessionStorage.setItem(submitSuccessStorageKey, JSON.stringify(data));
    } catch (error) {
      // sessionStorage can be unavailable in strict browser privacy modes.
    }
  }

  function initSubmitPage() {
    const form = document.querySelector('#submitForm');
    const message = document.querySelector('#submitMessage');
    const submitButton = form.querySelector('button[type="submit"]');
    const fileInput = form.querySelector('input[type="file"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(message, '', '');

      const fileError = validateFiles(fileInput);
      if (fileError) {
        setMessage(message, fileError, 'error');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = '提交中...';

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          body: new FormData(form),
        });
        const data = await readJson(response);
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(message, data.message || '提交失败，请稍后重试。', 'error');
          return;
        }

        const responseData = data.data || {};
        const orderNo = responseData.order_no || responseData.orderNo || data.orderNo;
        if (!orderNo) {
          setMessage(message, '提交成功，但未获取到订单号，请联系工作人员确认。', 'error');
          return;
        }

        const successData = {
          order_no: orderNo,
          task_type: responseData.task_type || getFormValue(form, 'task_type'),
          contact: responseData.contact || getFormValue(form, 'contact'),
          deadline: responseData.deadline || getFormValue(form, 'deadline'),
          created_at:
            responseData.created_at || responseData.createdAt || new Date().toISOString(),
          status: responseData.status || '未处理',
        };

        saveSubmitSuccessData(successData);
        window.location.href = `/submit-success?orderNo=${encodeURIComponent(orderNo)}`;
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '提交需求';
      }
    });
  }

  function initSubmitSuccessPage() {
    const params = new URLSearchParams(window.location.search);
    const urlOrderNo = (params.get('orderNo') || '').trim();
    const storedData = readSubmitSuccessData();
    const storedOrderNo = storedData?.order_no || storedData?.orderNo || '';
    const canUseStoredData = Boolean(
      storedData && (!urlOrderNo || storedOrderNo === urlOrderNo)
    );
    const orderNo = urlOrderNo || storedOrderNo;
    const detail = canUseStoredData ? storedData : {};
    const fallbackNote = document.querySelector('#successFallbackNote');
    const queryLink = document.querySelector('#successQueryLink');

    if (orderNo) {
      document.title = `${orderNo} - 需求提交成功`;
      setText('#successPageOrderNo', orderNo);
      if (queryLink) {
        queryLink.href = `/order-query?orderNo=${encodeURIComponent(orderNo)}`;
      }
    } else {
      setText('#successPageOrderNo', '未获取到订单号');
      if (fallbackNote) {
        fallbackNote.textContent =
          '当前页面没有读取到订单号，请返回提交页重新提交或联系工作人员确认。';
      }
    }

    if (!canUseStoredData && fallbackNote) {
      fallbackNote.classList.remove('is-hidden');
    }

    setText('#successTaskType', detail.task_type || detail.taskType || '-');
    setText('#successContact', detail.contact || '-');
    setText('#successDeadline', formatDateTime(detail.deadline));
    setText('#successCreatedAt', formatDateTime(detail.created_at || detail.createdAt));
    const status = typeof detail.status === 'string' ? detail.status.trim() : '';
    document.querySelector('#successStatus').innerHTML = status
      ? statusBadge(status)
      : '<span class="muted">无法确认</span>';
  }

  function initOrderQueryPage() {
    const form = document.querySelector('#orderQueryForm');
    const message = document.querySelector('#orderQueryMessage');
    const result = document.querySelector('#orderQueryResult');
    const button = form.querySelector('button[type="submit"]');
    const params = new URLSearchParams(window.location.search);
    const urlOrderNo = (params.get('orderNo') || '').trim();

    if (urlOrderNo) {
      form.order_no.value = urlOrderNo;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(message, '', '');
      result.classList.add('is-hidden');

      const orderNo = getFormValue(form, 'order_no');
      const contact = getFormValue(form, 'contact');
      if (!orderNo || !contact) {
        setMessage(message, '请填写订单号和联系方式。', 'error');
        return;
      }

      button.disabled = true;
      button.textContent = '查询中...';

      try {
        const response = await fetch('/api/customer/orders/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_no: orderNo,
            contact,
          }),
        });
        const data = await readJson(response);
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(
            message,
            data.message || '未查询到订单，请确认订单号和联系方式是否正确。',
            'error'
          );
          return;
        }

        renderOrderQueryResult(data.data || {});
        setMessage(message, '查询成功。', 'success');
        result.classList.remove('is-hidden');
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      } finally {
        button.disabled = false;
        button.textContent = '查询订单';
      }
    });
  }

  function renderOrderQueryResult(order) {
    const requirement = (order.requirement_summary || '').trim();

    setText('#queryOrderNo', order.order_no || '-');
    setText('#queryTaskType', order.task_type || '-');
    setText('#queryContact', order.contact || '-');
    setText('#queryDeadline', formatDateTime(order.deadline));
    setText('#queryCreatedAt', formatDateTime(order.created_at));
    setText('#queryFileCount', `${Number(order.file_count || 0)} 个`);

    const status =
      typeof order.status_label === 'string' ? order.status_label.trim() : '';
    document.querySelector('#queryStatus').innerHTML = status
      ? statusBadge(status)
      : '<span class="muted">无法确认</span>';

    const requirementBlock = document.querySelector('#queryRequirementBlock');
    if (requirement) {
      setText('#queryRequirement', requirement);
      requirementBlock.classList.remove('is-hidden');
    } else {
      requirementBlock.classList.add('is-hidden');
    }
  }

  function initLoginPage() {
    const form = document.querySelector('#loginForm');
    const message = document.querySelector('#loginMessage');
    const button = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(message, '', '');
      button.disabled = true;
      button.textContent = '登录中...';

      const payload = {
        username: form.username.value.trim(),
        password: form.password.value,
      };

      try {
        const response = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(message, data.message || '账号或密码不正确', 'error');
          return;
        }

        window.location.href = '/admin';
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      } finally {
        button.disabled = false;
        button.textContent = '登录';
      }
    });
  }

  function statusClass(status) {
    return {
      未处理: 'status-new',
      处理中: 'status-progress',
      已完成: 'status-done',
      已取消: 'status-cancelled',
    }[status] || 'status-new';
  }

  function statusBadge(status) {
    return `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
  }

  function localDayNumber(date) {
    return Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
  }

  function deadlineReminder(order) {
    if (['已完成', '已取消'].includes(order.status)) {
      return null;
    }

    const deadline = new Date(order.deadline);
    if (Number.isNaN(deadline.getTime())) {
      return null;
    }

    const diffDays = localDayNumber(deadline) - localDayNumber(new Date());
    if (diffDays < 0) {
      return { text: '已逾期', className: 'deadline-overdue' };
    }
    if (diffDays === 0) {
      return { text: '今日截止', className: 'deadline-today' };
    }
    if (diffDays <= 3) {
      return { text: '3天内截止', className: 'deadline-soon' };
    }

    return null;
  }

  function deadlineBadge(order) {
    const reminder = deadlineReminder(order);
    if (!reminder) {
      return '<span class="muted">-</span>';
    }

    return `<span class="deadline-badge ${reminder.className}">${reminder.text}</span>`;
  }

  function getAdminListParams() {
    return new URLSearchParams(window.location.search);
  }

  function getSortValue(params) {
    const sortBy = params.get('sortBy') || 'created_at';
    const sortOrder = params.get('sortOrder') || 'desc';
    const value = `${sortBy}:${sortOrder}`;
    return [
      'created_at:desc',
      'created_at:asc',
      'deadline:asc',
      'deadline:desc',
    ].includes(value)
      ? value
      : 'created_at:desc';
  }

  function syncSortInputs(sortSelect, sortByInput, sortOrderInput) {
    const [sortBy, sortOrder] = sortSelect.value.split(':');
    sortByInput.value = sortBy;
    sortOrderInput.value = sortOrder;
  }

  function hasActiveFilters(params) {
    return Boolean(
      (params.get('keyword') || '').trim() ||
        params.get('status') ||
        params.get('taskType')
    );
  }

  function buildAdminPageUrl(page) {
    const params = getAdminListParams();
    params.set('page', String(page));
    return `/admin?${params.toString()}`;
  }

  function initAdminListPage() {
    const message = document.querySelector('#listMessage');
    const body = document.querySelector('#ordersBody');
    const empty = document.querySelector('#emptyOrders');
    const refresh = document.querySelector('#refreshOrders');
    const form = document.querySelector('#orderFilters');
    const summary = document.querySelector('#ordersSummary');
    const paginationBar = document.querySelector('#paginationBar');
    const sortSelect = document.querySelector('#sortSelect');
    const sortByInput = document.querySelector('#sortByInput');
    const sortOrderInput = document.querySelector('#sortOrderInput');
    const params = getAdminListParams();

    form.keyword.value = params.get('keyword') || '';
    form.status.value = params.get('status') || '';
    form.taskType.value = params.get('taskType') || '';
    form.pageSize.value = ['10', '20', '50'].includes(params.get('pageSize'))
      ? params.get('pageSize')
      : '10';
    sortSelect.value = getSortValue(params);
    syncSortInputs(sortSelect, sortByInput, sortOrderInput);

    sortSelect.addEventListener('change', () => {
      syncSortInputs(sortSelect, sortByInput, sortOrderInput);
    });

    form.addEventListener('submit', () => {
      syncSortInputs(sortSelect, sortByInput, sortOrderInput);
    });

    function renderPagination(pagination) {
      const { total, page, pageSize, totalPages } = pagination;
      summary.textContent = `共 ${total} 条订单，每页 ${pageSize} 条`;
      paginationBar.classList.toggle('is-hidden', totalPages <= 1 && total === 0);

      const prevContent =
        page <= 1
          ? '<span class="secondary-button pagination-button is-disabled">上一页</span>'
          : `<a class="secondary-button pagination-button" href="${buildAdminPageUrl(
              page - 1
            )}">上一页</a>`;
      const nextContent =
        page >= totalPages
          ? '<span class="secondary-button pagination-button is-disabled">下一页</span>'
          : `<a class="secondary-button pagination-button" href="${buildAdminPageUrl(
              page + 1
            )}">下一页</a>`;

      paginationBar.innerHTML = `
        <div class="pagination-summary">第 ${page} / ${totalPages} 页</div>
        <div class="pagination-actions">
          ${prevContent}
          ${nextContent}
        </div>
      `;
    }

    async function loadOrders() {
      setMessage(message, '正在加载...', '');
      body.innerHTML = '';
      empty.classList.add('is-hidden');
      paginationBar.classList.add('is-hidden');

      try {
        const apiParams = getAdminListParams();
        const response = await fetch(`/api/admin/orders?${apiParams.toString()}`);
        const data = await readJson(response);
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(message, data.message || '加载失败。', 'error');
          return;
        }

        if (data.pagination) {
          const requestedPage = Number.parseInt(apiParams.get('page') || '1', 10) || 1;
          if (requestedPage !== data.pagination.page) {
            apiParams.set('page', String(data.pagination.page));
            window.history.replaceState(null, '', `/admin?${apiParams.toString()}`);
          }
          renderPagination(data.pagination);
        }

        if (!data.orders.length) {
          setMessage(message, '', '');
          empty.textContent = hasActiveFilters(apiParams)
            ? '暂无匹配订单'
            : '暂无提交记录';
          empty.classList.remove('is-hidden');
          return;
        }

        body.innerHTML = data.orders
          .map(
            (order) => `
              <tr>
                <td data-label="订单编号">${escapeHtml(order.order_no)}</td>
                <td data-label="客户姓名">${escapeHtml(order.customer_name)}</td>
                <td data-label="联系方式">${escapeHtml(order.contact)}</td>
                <td data-label="任务类型">${escapeHtml(order.task_type)}</td>
                <td data-label="截止时间">${escapeHtml(formatDateTime(order.deadline))}</td>
                <td data-label="截止提醒">${deadlineBadge(order)}</td>
                <td data-label="状态">${statusBadge(order.status)}</td>
                <td data-label="提交时间">${escapeHtml(formatDateTime(order.created_at))}</td>
                <td data-label="操作">
                  <a class="small-button" href="/admin/orders/${order.id}">查看</a>
                </td>
              </tr>
            `
          )
          .join('');
        setMessage(message, '', '');
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      }
    }

    refresh.addEventListener('click', loadOrders);
    loadOrders();
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value || '-';
  }

  function getOrderIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  function initAdminDetailPage() {
    const orderId = getOrderIdFromPath();
    const form = document.querySelector('#detailForm');
    const message = document.querySelector('#detailMessage');
    const statusSelect = document.querySelector('#statusSelect');
    const internalNote = document.querySelector('#internalNote');
    const fileList = document.querySelector('#fileList');
    const button = form.querySelector('button[type="submit"]');

    async function loadDetail() {
      setMessage(message, '正在加载...', '');

      try {
        const response = await fetch(`/api/admin/orders/${orderId}`);
        const data = await readJson(response);
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(message, data.message || '加载失败。', 'error');
          return;
        }

        const order = data.order;
        document.title = `${order.order_no} - 需求详情`;
        setText('#detailTitle', `订单详情 ${order.order_no}`);
        setText('#orderNo', order.order_no);
        setText('#customerName', order.customer_name);
        setText('#contact', order.contact);
        setText('#taskType', order.task_type);
        setText('#deadline', formatDateTime(order.deadline));
        setText('#createdAt', formatDateTime(order.created_at));
        setText('#requirement', order.requirement);
        setText('#extraNote', order.extra_note || '无');
        document.querySelector('#currentStatus').innerHTML = statusBadge(order.status);
        statusSelect.value = order.status;
        internalNote.value = order.internal_note || '';

        if (!data.files.length) {
          fileList.innerHTML = '<li class="muted">未上传文件</li>';
        } else {
          fileList.innerHTML = data.files
            .map(
              (file) => `
                <li>
                  <a href="/admin/files/${file.id}/download">${escapeHtml(file.original_name)}</a>
                  <span>${escapeHtml(formatFileSize(file.size))}</span>
                </li>
              `
            )
            .join('');
        }

        setMessage(message, '', '');
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      button.disabled = true;
      button.textContent = '保存中...';

      try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: statusSelect.value,
            internal_note: internalNote.value,
          }),
        });
        const data = await readJson(response);
        if (!data) return;

        if (!response.ok || !data.success) {
          setMessage(message, data.message || '保存失败。', 'error');
          return;
        }

        setMessage(message, '保存成功。', 'success');
        document.querySelector('#currentStatus').innerHTML = statusBadge(
          data.order.status
        );
      } catch (error) {
        setMessage(message, '网络异常，请稍后重试。', 'error');
      } finally {
        button.disabled = false;
        button.textContent = '保存修改';
      }
    });

    loadDetail();
  }
})();
