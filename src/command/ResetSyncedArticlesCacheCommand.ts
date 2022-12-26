import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';

export default class ClearSyncedArticlesCacheCommand implements Command {
  id = 'wallabag-clear-synced-articles-cache';
  name = 'Clear synced articles cache';

  private plugin: WallabagPlugin;
  private syncedFilePath: string;

  constructor(plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.syncedFilePath = `${this.plugin.manifest.dir}/.synced`;
  }

  async callback() {
    const notice = new Notice('Clearing synced articles cache.');
    await this.plugin.app.vault.adapter.write(this.syncedFilePath, JSON.stringify([]));
    notice.hide();
    new Notice('Synced articles cache is cleared.');
  }

}
