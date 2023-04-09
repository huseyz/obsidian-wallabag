export interface WallabagSettings {
  serverUrl: string;
  tag: string;
  folder: string;
  downloadAsPDF: string;
  articleTemplate: string;
  pdfFolder: string;
  createPDFNote: string;
  convertHtmlToMarkdown: string;
  idInTitle: string;
  archiveAfterSync: string;
  syncOnStartup: string;
}

export const DEFAULT_SETTINGS: WallabagSettings = {
  serverUrl: '',
  tag: '',
  folder: '',
  downloadAsPDF: 'false',
  articleTemplate: '',
  pdfFolder: '',
  createPDFNote: 'false',
  convertHtmlToMarkdown: 'false',
  idInTitle: 'false',
  archiveAfterSync: 'false',
  syncOnStartup: 'false',
};
