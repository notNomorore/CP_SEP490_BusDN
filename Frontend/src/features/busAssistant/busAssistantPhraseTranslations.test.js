import { describe, expect, it } from 'vitest';
import { translateBusAssistantPhrase } from './busAssistantPhraseTranslations.js';

describe('bus assistant phrase translations', () => {
  it('translates Vietnamese and English in both directions', () => {
    expect(translateBusAssistantPhrase('Làm mới', 'en')).toBe('Refresh');
    expect(translateBusAssistantPhrase('Refresh', 'vi')).toBe('Làm mới');
    expect(translateBusAssistantPhrase('Chuyến được phân công', 'en')).toBe('Assigned trips');
    expect(translateBusAssistantPhrase('Assigned trips', 'vi')).toBe('Chuyến được phân công');
  });

  it('preserves surrounding whitespace', () => {
    expect(translateBusAssistantPhrase('  Tiếp  ', 'en')).toBe('  Next  ');
  });

  it('translates dynamic validation counts', () => {
    expect(translateBusAssistantPhrase('3 successful validation(s) on this date.', 'vi'))
      .toBe('3 lượt kiểm tra thành công trong ngày này.');
    expect(translateBusAssistantPhrase('3 lượt kiểm tra thành công trong ngày này.', 'en'))
      .toBe('3 successful validation(s) on this date.');
  });
});
