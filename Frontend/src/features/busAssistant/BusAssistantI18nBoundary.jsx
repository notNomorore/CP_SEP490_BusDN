import React, { useEffect, useRef } from 'react';
import useLanguage from '../../shared/hooks/useLanguage.js';
import { translateBusAssistantPhrase } from './busAssistantPhraseTranslations.js';

const translatedAttributes = ['placeholder', 'title', 'aria-label'];

const translateNode = (node, language) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) return;
    const translated = translateBusAssistantPhrase(node.nodeValue || '', language);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }

  if (!(node instanceof HTMLElement)) return;
  translatedAttributes.forEach((attribute) => {
    if (!node.hasAttribute(attribute)) return;
    const current = node.getAttribute(attribute) || '';
    const translated = translateBusAssistantPhrase(current, language);
    if (translated !== current) node.setAttribute(attribute, translated);
  });
};

const translateTree = (root, language) => {
  translateNode(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateNode(node, language);
    node = walker.nextNode();
  }
};

const BusAssistantI18nBoundary = ({ children }) => {
  const rootRef = useRef(null);
  const { language } = useLanguage();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    translateTree(root, language);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') {
          translateNode(mutation.target, language);
        }
        mutation.addedNodes.forEach((node) => translateTree(node, language));
      });
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: translatedAttributes,
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return (
    <div ref={rootRef} data-local-i18n="bus-assistant" className="contents">
      {children}
    </div>
  );
};

export default BusAssistantI18nBoundary;
