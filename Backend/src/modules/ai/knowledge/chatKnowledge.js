import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeForPolicy } from '../policies/chatPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faqPath = path.join(__dirname, 'busdn-faq.json');
const faqEntries = JSON.parse(fs.readFileSync(faqPath, 'utf8'));

const scoreEntry = (entry, text) => {
  const normalized = normalizeForPolicy(text);
  return (entry.keywords || []).reduce((score, keyword) => (
    normalized.includes(normalizeForPolicy(keyword)) ? score + 1 : score
  ), 0);
};

export const searchKnowledgeBase = (text, { limit = 2 } = {}) => faqEntries
  .map((entry) => ({
    ...entry,
    score: scoreEntry(entry, text),
  }))
  .filter((entry) => entry.score > 0)
  .sort((left, right) => right.score - left.score)
  .slice(0, limit);

export default {
  searchKnowledgeBase,
};
