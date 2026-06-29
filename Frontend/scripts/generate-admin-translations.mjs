import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const projectRoot = process.cwd();
const sourceRoots = [
  'src/features',
  'src/shared/components',
];
const outputFile = path.join(projectRoot, 'src/shared/i18n/adminPhraseTranslations.generated.js');
const cacheFile = path.join(projectRoot, 'scripts/admin-translation-cache.json');
const attributeNames = new Set(['placeholder', 'title', 'aria-label', 'alt']);
const objectKeys = new Set([
  'label', 'title', 'description', 'emptyText', 'message', 'actionLabel',
  'subtitle', 'detail', 'note',
]);
const excludedAttributes = new Set([
  'className', 'to', 'href', 'path', 'icon', 'type', 'value', 'id', 'name',
]);

const manualOverrides = {
  'Fleet Operations': { en: 'Fleet Operations', vi: 'Vận hành đội xe' },
  'Active Trips': { en: 'Active Trips', vi: 'Chuyến đang chạy' },
  'Delayed Trips': { en: 'Delayed Trips', vi: 'Chuyến trễ' },
  'Live Fleet Map': { en: 'Live Fleet Map', vi: 'Bản đồ đội xe trực tiếp' },
  'Routes & Scheduling': { en: 'Routes & Scheduling', vi: 'Tuyến và lịch chạy' },
  'Route Analytics': { en: 'Route Analytics', vi: 'Phân tích tuyến' },
  'Fare Operations': { en: 'Fare Operations', vi: 'Vận hành giá vé' },
  'Walk-in Tickets': { en: 'Walk-in Tickets', vi: 'Vé mua trực tiếp' },
  'Vehicle Issues': { en: 'Vehicle Issues', vi: 'Sự cố phương tiện' },
  'Maintenance Approval': { en: 'Maintenance Approval', vi: 'Duyệt bảo trì' },
  'Passenger Compliance': { en: 'Passenger Compliance', vi: 'Vi phạm hành khách' },
  'User Management': { en: 'User Management', vi: 'Quản lý người dùng' },
  'Priority Verification': { en: 'Priority Verification', vi: 'Xác minh ưu tiên' },
  'Customer Support': { en: 'Customer Support', vi: 'Hỗ trợ khách hàng' },
  'System Notifications': { en: 'System Notifications', vi: 'Thông báo hệ thống' },
  'System Monitoring': { en: 'System Monitoring', vi: 'Giám sát hệ thống' },
  'Emergency Alert': { en: 'Emergency Alert', vi: 'Cảnh báo khẩn cấp' },
  'Logout': { en: 'Logout', vi: 'Đăng xuất' },
  'No data found': { en: 'No data found', vi: 'Không tìm thấy dữ liệu' },
  'All statuses': { en: 'All statuses', vi: 'Tất cả trạng thái' },
  'Actions': { en: 'Actions', vi: 'Thao tác' },
  'Status': { en: 'Status', vi: 'Trạng thái' },
  'Previous': { en: 'Previous', vi: 'Trước' },
  'Next': { en: 'Next', vi: 'Tiếp' },
  'Save': { en: 'Save', vi: 'Lưu' },
  'Cancel': { en: 'Cancel', vi: 'Hủy' },
  'Delete': { en: 'Delete', vi: 'Xóa' },
  'Update': { en: 'Update', vi: 'Cập nhật' },
  'Create': { en: 'Create', vi: 'Tạo' },
};

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const isHumanText = (value) => {
  const text = clean(value);
  if (text.length < 2 || text.length > 600) return false;
  if (/^(https?:|\/|\.\/|\.\.\/|#[0-9a-f]{3,8}$)/i.test(text)) return false;
  if (/^[a-z][a-z0-9_]+$/.test(text)) return false;
  if (/^(bg|text|border|rounded|shadow|grid|flex|hover|focus|md|lg|xl|sm):?/.test(text)) return false;
  if (/[{}[\]<>]/.test(text) && !/\s/.test(text)) return false;
  return /[A-Za-zÀ-ỹ]/.test(text);
};

const collectFiles = (entry, files) => {
  const absolute = path.join(projectRoot, entry);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    files.push(absolute);
    return;
  }
  for (const item of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, item.name);
    if (item.isDirectory()) collectFiles(path.relative(projectRoot, child), files);
    else if (/\.(jsx|js)$/.test(item.name) && !child.includes(`${path.sep}services${path.sep}`)) files.push(child);
  }
};

const phrases = new Set();
const add = (value) => {
  const text = clean(value);
  if (isHumanText(text)) phrases.add(text);
};

const files = [];
sourceRoots.forEach((entry) => collectFiles(entry, files));
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  traverse(ast, {
    JSXText(nodePath) {
      add(nodePath.node.value);
    },
    JSXAttribute(nodePath) {
      const name = nodePath.node.name?.name;
      if (excludedAttributes.has(name) || !attributeNames.has(name)) return;
      if (nodePath.node.value?.type === 'StringLiteral') add(nodePath.node.value.value);
    },
    CallExpression(nodePath) {
      const method = nodePath.node.callee?.property?.name;
      if (!['success', 'error'].includes(method)) return;
      const first = nodePath.node.arguments[0];
      if (first?.type === 'StringLiteral') add(first.value);
    },
    ObjectProperty(nodePath) {
      const key = nodePath.node.key?.name || nodePath.node.key?.value;
      if (!objectKeys.has(key)) return;
      if (nodePath.node.value?.type === 'StringLiteral') add(nodePath.node.value.value);
    },
    StringLiteral(nodePath) {
      const parent = nodePath.parent;
      if (parent?.type === 'ImportDeclaration' || parent?.type === 'ExportNamedDeclaration') return;
      if (parent?.type === 'JSXAttribute') return;
      if (parent?.type === 'ObjectProperty') {
        const key = parent.key?.name || parent.key?.value;
        if (!objectKeys.has(key)) return;
      }
      if (
        parent?.type === 'ConditionalExpression'
        || parent?.type === 'LogicalExpression'
        || parent?.type === 'ArrayExpression'
        || parent?.type === 'JSXExpressionContainer'
      ) add(nodePath.node.value);
    },
  });
}

const cache = fs.existsSync(cacheFile)
  ? JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  : {};

const separator = '\n⟦987654321⟧\n';
const translateBatch = async (items, target, source = 'auto') => {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', source);
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', items.join(separator));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translated = payload[0].map((part) => part[0]).join('');
  const parts = translated.split(/\s*[?⟦]987654321[?⟧]\s*/);
  if (parts.length !== items.length) {
    throw new Error(`Translation batch mismatch: expected ${items.length}, received ${parts.length}`);
  }
  return parts.map(clean);
};

const pending = [...phrases].filter((phrase) => !cache[phrase]);
for (let index = 0; index < pending.length; index += 12) {
  const batch = pending.slice(index, index + 12);
  const [english, vietnamese] = await Promise.all([
    translateBatch(batch, 'en'),
    translateBatch(batch, 'vi'),
  ]);
  batch.forEach((phrase, itemIndex) => {
    cache[phrase] = { en: english[itemIndex] || phrase, vi: vietnamese[itemIndex] || phrase };
  });
  fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
  console.log(`Translated ${Math.min(index + batch.length, pending.length)}/${pending.length}`);
}

const shouldForceEnglishTranslation = (phrase, translation) => {
  if (translation.vi.toLowerCase() !== phrase.toLowerCase()) return false;
  if (translation.en.toLowerCase() !== phrase.toLowerCase()) return false;
  if (/@|https?:|rgba|linear-gradient|background-image/i.test(phrase)) return false;
  if (/^(from|via|to|divide|opacity|route-control|stop-map)-/i.test(phrase)) return false;
  if (/^[a-z]+[A-Z][A-Za-z]+$/.test(phrase)) return false;
  if (/^[a-z]+(Fare|Route|Station|Offset|Name|Code|Id|Type|Status|Date|At)$/.test(phrase)) return false;
  if (/^[a-z0-9,-]+$/i.test(phrase) && phrase.includes(',')) return false;
  return /^[\x00-\x7F]+$/.test(phrase) && /[A-Za-z]{2}/.test(phrase);
};

const repairItems = Object.entries(cache)
  .filter(([phrase, translation]) => shouldForceEnglishTranslation(phrase, translation))
  .map(([phrase]) => phrase);

for (let index = 0; index < repairItems.length; index += 12) {
  const batch = repairItems.slice(index, index + 12);
  const translationInput = batch.map((phrase) => (
    /^[A-Z][A-Z_]+$/.test(phrase) ? phrase.replaceAll('_', ' ').toLowerCase() : phrase
  ));
  const vietnamese = await translateBatch(translationInput, 'vi', 'en');
  batch.forEach((phrase, itemIndex) => {
    cache[phrase].vi = vietnamese[itemIndex] || phrase;
  });
  fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
  console.log(`Repaired ${Math.min(index + batch.length, repairItems.length)}/${repairItems.length}`);
}

const catalog = Object.fromEntries(
  [...phrases]
    .sort((left, right) => left.localeCompare(right))
    .map((phrase) => [phrase, manualOverrides[phrase] || cache[phrase] || { en: phrase, vi: phrase }]),
);

const output = `// Generated by scripts/generate-admin-translations.mjs. Do not edit manually.\n`
  + `export const adminPhraseTranslations = ${JSON.stringify(catalog, null, 2)};\n`;
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output);
console.log(`Wrote ${Object.keys(catalog).length} translations to ${path.relative(projectRoot, outputFile)}`);
