// 서버가 화면에 보내는 메시지는 {ko, en} 쌍으로 만들고, 브라우저가 현재 언어로 고른다.
export const L = (ko, en) => ({ ko, en });
export class I18nError extends Error {
  constructor(ko, en) { super(en ?? ko); this.i18n = { ko, en: en ?? ko }; }
}
