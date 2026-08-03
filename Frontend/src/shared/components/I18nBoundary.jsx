import { useEffect } from 'react';
import useLanguage from '../hooks/useLanguage.js';
import { translateAdminPhrase } from '../i18n/adminI18n.js';
import { translateBusAssistantPhrase } from '../../features/busAssistant/busAssistantPhraseTranslations.js';
import { translateScheduleOperationsPhrase } from '../../features/scheduleOperations/scheduleOperationsPhraseTranslations.js';

const originalText = new WeakMap();
const appliedText = new WeakMap();
const originalAttributes = new WeakMap();
const translatedAttributes = ['placeholder', 'title', 'aria-label'];

const shouldSkipTextNode = (node) => {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest('[data-local-i18n]')) return true;
  if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) return true;
  return parent.classList.contains('material-symbols-outlined');
};

const translateTextNode = (node, language, refreshOriginal = false) => {
  if (shouldSkipTextNode(node)) return;
  const current = node.nodeValue || '';
  if (refreshOriginal && current !== appliedText.get(node)) originalText.set(node, current);
  if (!originalText.has(node)) originalText.set(node, current);
  const source = originalText.get(node);
  const adminTranslated = translateAdminPhrase(source, language);
  const translated = window.location.pathname.startsWith('/bus-assistant')
    ? translateBusAssistantPhrase(source, language, adminTranslated)
    : window.location.pathname.startsWith('/operations')
      ? translateScheduleOperationsPhrase(source, language, adminTranslated)
      : adminTranslated;
  appliedText.set(node, translated);
  if (current !== translated) node.nodeValue = translated;
};

const translateElementAttributes = (element, language, refreshOriginal = false) => {
  if (!(element instanceof HTMLElement)) return;
  if (element.closest('[data-local-i18n]')) return;
  const stored = originalAttributes.get(element) || {};
  let changed = false;

  translatedAttributes.forEach((attribute) => {
    if (!element.hasAttribute(attribute)) return;
    const current = element.getAttribute(attribute) || '';
    const translatedMarker = stored[`${attribute}Translated`];
    if (!(attribute in stored) || (refreshOriginal && current !== translatedMarker)) {
      stored[attribute] = current;
    }
    const adminTranslated = translateAdminPhrase(stored[attribute], language);
    const translated = window.location.pathname.startsWith('/bus-assistant')
      ? translateBusAssistantPhrase(stored[attribute], language, adminTranslated)
      : window.location.pathname.startsWith('/operations')
        ? translateScheduleOperationsPhrase(stored[attribute], language, adminTranslated)
        : adminTranslated;
    stored[`${attribute}Translated`] = translated;
    if (current !== translated) element.setAttribute(attribute, translated);
    changed = true;
  });

  if (changed) originalAttributes.set(element, stored);
};

const translateTree = (root, language, refreshOriginal = false) => {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language, refreshOriginal);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof HTMLElement) translateElementAttributes(root, language, refreshOriginal);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language, refreshOriginal);
    else translateElementAttributes(node, language, refreshOriginal);
    node = walker.nextNode();
  }
};

const I18nBoundary = ({ children }) => {
  const { language } = useLanguage();

  useEffect(() => {
    let animationFrameId = null;
    const translateAfterRender = (nextLanguage) => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        document.documentElement.lang = nextLanguage;
        translateTree(document.body, nextLanguage);
      });
    };

    document.documentElement.lang = language;
    translateTree(document.body, language);

    const handleLanguageChange = (event) => {
      const nextLanguage = event.detail?.language;
      if (nextLanguage === 'vi' || nextLanguage === 'en') {
        translateAfterRender(nextLanguage);
      }
    };
    window.addEventListener('app-language-change', handleLanguageChange);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, language, true);
          return;
        }
        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target, language, true);
          return;
        }
        mutation.addedNodes.forEach((node) => translateTree(node, language, true));
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: translatedAttributes,
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('app-language-change', handleLanguageChange);
      observer.disconnect();
    };
  }, [language]);

  return children;
};

export default I18nBoundary;
