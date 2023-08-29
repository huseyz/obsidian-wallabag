import DeleteNoteAndRemoveFromSyncedCacheCommand from 'command/DeleteNoteAndRemoveFromSyncedCacheCommand';
import ClearSyncedArticlesCacheCommand from 'command/ResetSyncedArticlesCacheCommand';
import SyncArticlesCommand from 'command/SyncArticlesCommand';
import { Notice, Plugin } from 'obsidian';
import { WallabagSettingTab } from 'settings/WallabagSettingTab';
import WallabagAPI from 'wallabag/WallabagAPI';
import { loadTokenFromVault, removeTokenFromVault, storeTokenToVault, Token } from 'wallabag/WallabagAuth';
import { DEFAULT_SETTINGS, WallabagSettings } from './settings/WallabagSettings';

export default class WallabagPlugin extends Plugin {
  settings: WallabagSettings;
  api: WallabagAPI;
  authenticated: boolean;

  override async onload() {
    await this.init();

    const syncArticlesCommand = new SyncArticlesCommand(this);

    this.addSettingTab(new WallabagSettingTab(this.app, this, _ => this.authenticated));
    this.addCommand(syncArticlesCommand);
    this.addCommand(new ClearSyncedArticlesCacheCommand(this));
    this.addCommand(new DeleteNoteAndRemoveFromSyncedCacheCommand(this));

    if (this.settings.syncOnStartup === 'true') {
      syncArticlesCommand.callback();
    }

    // This creates an icon in the left ribbon.
    this.addRibbonIcon('sheets-in-box', 'Sync Wallabag articles', () => syncArticlesCommand.callback());
  }

  private async init() {
    await this.loadSettings();
    await this.loadToken();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadToken() {
    return loadTokenFromVault(this).then((token) => {
      if (token) {
        this.api = new WallabagAPI(token, this);
        this.authenticated = true;
      } else {
        new Notice('Please authenticate with Wallabag to start syncing.');
      }
    });
  }

  async onAuthenticated(token: Token) {
    await storeTokenToVault(this, token);
    await this.loadToken();
  }

  async onLogout() {
    await removeTokenFromVault(this);
    this.authenticated = false;
  }

  async onTokenRefreshFailed() {
    await this.onLogout();
    new Notice('Authentication refresh has failed. Please authenticate again.');
  }
}
