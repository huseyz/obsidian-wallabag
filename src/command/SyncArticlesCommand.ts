import WallabagPlugin from 'main';
import NoteTemplate, {DefaultTemplate, PDFTemplate} from 'note/NoteTemplate';
import {
  Command,
  Notice,
  sanitizeHTMLToDom,
  normalizePath,
  TFile,
  parseFrontMatterTags
} from 'obsidian';
import {WallabagArticle} from 'wallabag/WallabagAPI';

export default class SyncArticlesCommand implements Command {
  id = 'sync-articles';
  name = 'Sync Wallabag Articles';

  private plugin: WallabagPlugin;
  private syncedFilePath: string;

  constructor(plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.syncedFilePath = `${this.plugin.manifest.dir}/.synced`;
  }

  private async readSynced(): Promise<number[]> {
    const exists = await this.plugin.app.vault.adapter.exists(this.syncedFilePath);
    if (exists) {
      return await this.plugin.app.vault.adapter.read(this.syncedFilePath).then(JSON.parse);
    } else {
      return [];
    }
  }

  private async writeSynced(ids: number[]): Promise<void> {
    return await this.plugin.app.vault.adapter.write(this.syncedFilePath, JSON.stringify(ids));
  }

  private async getUserTemplate(): Promise<NoteTemplate> {
    const template = await this.plugin.app.vault.adapter.read(`${this.plugin.settings.articleTemplate}.md`);
    return new NoteTemplate(template);
  }

  private getFolder(wallabagArticle: WallabagArticle): string {
    if (wallabagArticle.isArchived && this.plugin.settings.archivedFolder !== '') {
      return this.plugin.settings.archivedFolder;
    } else if (!wallabagArticle.isArchived && this.plugin.settings.unreadFolder !== '') {
      return this.plugin.settings.unreadFolder;
    } else {
      return this.plugin.settings.folder;
    }
  }

  private getFilename(wallabagArticle: WallabagArticle): string {
    const filename = wallabagArticle.title.replaceAll(/[\\,#%&{}/*<>$"@.?]/g, ' ').replaceAll(/[:|]/g, ' ');
    if (this.plugin.settings.idInTitle === 'true') {
      return `${filename}-${wallabagArticle.id}`;
    } else {
      return filename;
    }
  }

  private async createOrModifyNote(filename: string, content: string, article: WallabagArticle, previouslySynced: number[]) {
    const exists = await this.plugin.app.vault.adapter.exists(filename);
    const note = this.plugin.app.vault.getAbstractFileByPath(filename);
    if (exists) {
      if (note instanceof TFile) {
        // if note contains a special marker tag - don't replace it
        const cmeta = this.plugin.app.metadataCache.getFileCache(note);
        if ((!cmeta?.tags?.find(t => t.tag === '#wallaSave')) && (!parseFrontMatterTags(cmeta?.frontmatter)?.find((t: string) => t === '#wallaSave'))) {
          await this.plugin.app.vault.modify(note, content);
        }
      }
    } else {
      // if the note was synced previously, don't recreate it
      if (!previouslySynced.contains(article.id)) {
        await this.plugin.app.vault.create(filename, content);
      }
    }
  }

  async callback() {
    if (!this.plugin.authenticated) {
      new Notice('Please authenticate with Wallabag first.');
      return;
    } else if (this.plugin.settings.syncUnRead === 'false' && this.plugin.settings.syncArchived === 'false') {
      new Notice('Please select at least one type of article to sync.');
      return;
    }

    const previouslySynced = await this.readSynced();

    const fetchNotice = new Notice('Syncing from Wallabag..');

    const articles = await this.plugin.api.fetchArticles(this.plugin.settings.syncUnRead === 'true' ? true : false, this.plugin.settings.syncArchived === 'true' ? true : false);
    const newIds = await Promise.all(articles
    // .filter((article) => !previouslySynced.contains(article.id))
      .map(async (article) => {
        const folder = this.getFolder(article);
        if (this.plugin.settings.downloadAsPDF !== 'true') {
          const template = this.plugin.settings.articleTemplate === '' ? DefaultTemplate : await this.getUserTemplate();
          const filename = normalizePath(`${folder}/${this.getFilename(article)}.md`);
          const content = template.fill(article, this.plugin.settings.serverUrl, this.plugin.settings.convertHtmlToMarkdown, this.plugin.settings.tagFormat);
          await this.createOrModifyNote(filename, content, article, previouslySynced);
        } else {
          const pdfFilename = normalizePath(`${this.plugin.settings.pdfFolder}/${this.getFilename(article)}.pdf`);
          const pdf = await this.plugin.api.exportArticle(article.id);
          await this.plugin.app.vault.adapter.writeBinary(pdfFilename, pdf);
          if (this.plugin.settings.createPDFNote) {
            const template = this.plugin.settings.articleTemplate === '' ? PDFTemplate : await this.getUserTemplate();
            const filename = normalizePath(`${folder}/${this.getFilename(article)}.md`);
            const content = template.fill(article, this.plugin.settings.serverUrl, this.plugin.settings.tagFormat, pdfFilename);
            await this.createOrModifyNote(filename, content, article, previouslySynced);
          }
        }
        if (this.plugin.settings.archiveAfterSync === 'true') {
          await this.plugin.api.archiveArticle(article.id);
        }
        return article.id;
      }));
    await this.writeSynced([...newIds, ...previouslySynced]);
    fetchNotice.setMessage(sanitizeHTMLToDom(`Sync from Wallabag is now completed. <br> ${newIds.length} new article(s) has been synced.`));
  }

}
