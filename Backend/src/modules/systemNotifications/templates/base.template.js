export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const compactRows = (rows = []) => rows
  .map((row) => ({
    label: String(row.label || '').trim(),
    value: row.value,
  }))
  .filter((row) => row.label && row.value !== undefined && row.value !== null && String(row.value).trim() !== '');

export const formatCurrencyVnd = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `${amount.toLocaleString('vi-VN')} VND`;
};

export const formatDateTimeVi = (value) => {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const renderNotificationEmailLayout = ({
  title,
  intro,
  rows = [],
  body = '',
  extraHtml = '',
  actionUrl = '',
  footer = 'Cảm ơn bạn đã tin tưởng và ủng hộ BusDN.',
}) => {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro).replace(/\n/g, '<br />');
  const safeBody = escapeHtml(body).replace(/\n/g, '<br />');
  const safeFooter = escapeHtml(footer);
  const safeActionUrl = escapeHtml(actionUrl);
  const tableRows = compactRows(rows)
    .map((row) => `
      <tr>
        <td class="label">${escapeHtml(row.label)}</td>
        <td class="value">${escapeHtml(row.value)}</td>
      </tr>
    `)
    .join('');
  const detailsMarkup = tableRows
    ? `<table class="details" role="presentation" cellspacing="0" cellpadding="0">${tableRows}</table>`
    : '';
  const actionMarkup = actionUrl
    ? `<p class="action"><a href="${safeActionUrl}">Mở trong BusDN</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #eef2f4; color: #1f2937; font-family: Arial, Helvetica, sans-serif; }
    .wrap { width: 100%; padding: 24px 12px; box-sizing: border-box; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #d8e1e6; border-radius: 8px; overflow: hidden; }
    .header { background: #0f766e; color: #ffffff; padding: 22px 24px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0; margin: 0 0 8px; text-transform: uppercase; }
    h1 { font-size: 22px; line-height: 1.3; margin: 0; font-weight: 700; }
    .content { padding: 24px; }
    p { font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .details { width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #d8e1e6; border-radius: 6px; overflow: hidden; }
    .details td { padding: 12px 14px; border-bottom: 1px solid #e6edf1; font-size: 14px; vertical-align: top; }
    .details tr:last-child td { border-bottom: 0; }
    .label { width: 42%; background: #f6f9fa; color: #52616b; font-weight: 700; }
    .value { color: #111827; }
    .action a { display: inline-block; background: #0f766e; color: #ffffff; padding: 11px 16px; border-radius: 6px; text-decoration: none; font-weight: 700; }
    .footer { color: #64748b; font-size: 12px; line-height: 1.5; padding-top: 16px; border-top: 1px solid #e6edf1; }
    @media (max-width: 520px) {
      .wrap { padding: 12px 8px; }
      .header, .content { padding: 18px; }
      .details td { display: block; width: auto; border-bottom: 0; padding: 9px 12px; }
      .details tr { display: block; border-bottom: 1px solid #e6edf1; }
      .details tr:last-child { border-bottom: 0; }
      .label { background: #f6f9fa; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="container">
      <div class="header">
        <p class="brand">BusDN</p>
        <h1>${safeTitle}</h1>
      </div>
      <div class="content">
        ${intro ? `<p>${safeIntro}</p>` : ''}
        ${body ? `<p>${safeBody}</p>` : ''}
        ${detailsMarkup}
        ${extraHtml}
        ${actionMarkup}
        <p>${safeFooter}</p>
        <p class="footer">Đây là email tự động từ BusDN. Vui lòng không trả lời email này.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const renderTextEmail = ({
  title,
  intro,
  rows = [],
  body = '',
  actionUrl = '',
  footer = 'Cảm ơn bạn đã tin tưởng và ủng hộ BusDN.',
}) => [
  'BusDN',
  title,
  '',
  intro,
  body,
  ...compactRows(rows).flatMap((row) => [`${row.label}: ${row.value}`]),
  actionUrl ? `Mở trong BusDN: ${actionUrl}` : '',
  '',
  footer,
  'Đây là email tự động từ BusDN. Vui lòng không trả lời email này.',
].filter((line) => line !== '').join('\n');
