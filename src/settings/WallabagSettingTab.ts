import WallabagPlugin from 'main';
import { App, Notice, PluginSettingTab, sanitizeHTMLToDom, Setting } from 'obsidian';
import WallabagAPI from 'wallabag/WallabagAPI';
import { WallabagSettings } from './WallabagSettings';

export interface TextSetting {
  name: string,
  desc: string | DocumentFragment,
  class?: string,
  get: () => string
  set: (v: string) => void
}

export class WallabagSettingTab extends PluginSettingTab {

  private plugin: WallabagPlugin;
  private isAuthenticated: (_: void) => boolean;

  constructor(app: App, plugin: WallabagPlugin, isAuthenticated: (_: void) => boolean) {
    super(app, plugin);
    this.plugin = plugin;
    this.isAuthenticated = isAuthenticated;
  }

  display() {
    this.containerEl.empty();
    ([
      {
        name: 'Server URL',
        desc: 'Wallabag server to connect.',
        get: () => this.plugin.settings.serverUrl,
        set: this.updateSetting('serverUrl')
      },
      {
        name: 'Tag to sync',
        desc: 'If set, only articles with the this tag will be synced.',
        get: () => this.plugin.settings.tag,
        set: this.updateSetting('tag')
      },
      {
        name: 'Wallabag article notes folder location',
        desc: 'Choose the location where the synced article notes will be created.',
        get: () => this.plugin.settings.folder,
        set: this.updateSetting('folder')
      },
      {
        name: 'Article note template file',
        desc: sanitizeHTMLToDom(
          'The template file that will be used for the new articles.<br> ' +
          'See <a href="https://github.com/huseyz/obsidian-wallabag">documentation</a> for examples.'
        ),
        get: () => this.plugin.settings.articleTemplate,
        set: this.updateSetting('articleTemplate')
      },
    ] as TextSetting[]).forEach(this.addTextSettingHere);

    new Setting(this.containerEl)
      .setName('Sync on startup')
      .setDesc('If enabled, articles will be synced on startup.')
      .addToggle(async (toggle) => {
        toggle
          .setValue(this.plugin.settings.syncOnStartup === 'true')
          .onChange(async (value) => {
            this.plugin.settings.syncOnStartup = String(value);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(this.containerEl)
      .setName('Sync archived articles')
      .setDesc('If enabled, archived articles will be synced.')
      .addToggle(async (toggle) => {
        toggle
          .setValue(this.plugin.settings.syncArchived === 'true')
          .onChange(async (value) => {
            this.plugin.settings.syncArchived = String(value);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(this.containerEl)
      .setName('Export as PDF')
      .setDesc('If enabled synced articles will be exported as PDFs.')
      .addToggle(async (toggle) => {
        toggle
          .setValue(this.plugin.settings.downloadAsPDF === 'true')
          .onChange(async (value) => {
            this.plugin.settings.downloadAsPDF = String(value);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const pdfSettingsClass = this.plugin.settings.downloadAsPDF !== 'true' ? 'wallabag-setting-hidden' : 'wallabag-pdf-setting';

    this.addTextSettingHere({
      name: 'PDF Folder',
      desc: 'The folder exported PDFs will be downloaded.',
      get: () => this.plugin.settings.pdfFolder,
      set: this.updateSetting('pdfFolder'),
      class: pdfSettingsClass
    });

    new Setting(this.containerEl)
      .setName('Create note')
      .setDesc('If enabled a note will be created in the article note folder for each article exported as pdf. Article note template will be used if specified.')
      .setClass(pdfSettingsClass)
      .addToggle(async (toggle) => {
        toggle.setValue(this.plugin.settings.createPDFNote === 'true');
        toggle.onChange(async (value) => {
          this.plugin.settings.createPDFNote = String(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(this.containerEl)
      .setName('Convert HTML Content extracted by Wallabag to Markdown')
      .setDesc('If enabled the content of the Wallabag article will be converted to markdown before being used for the new article.')
      .addToggle(async (toggle) => {
        toggle.setValue(this.plugin.settings.convertHtmlToMarkdown === 'true');
        toggle.onChange(async (value) => {
          this.plugin.settings.convertHtmlToMarkdown = String(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(this.containerEl)
      .setName('Archive article after sync')
      .setDesc('If enabled the article will be archived after being synced.')
      .addToggle(async (toggle) => {
        toggle.setValue(this.plugin.settings.archiveAfterSync === 'true');
        toggle.onChange(async (value) => {
          this.plugin.settings.archiveAfterSync = String(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(this.containerEl)
      .setName('Add article ID in the title')
      .setDesc('If enabled the article ID will be added to title.')
      .addToggle(async (toggle) => {
        toggle.setValue(this.plugin.settings.idInTitle === 'true');
        toggle.onChange(async (value) => {
          this.plugin.settings.idInTitle = String(value);
          await this.plugin.saveSettings();
        });
      });
    new Setting(this.containerEl)
      .setName('Tag format')
      .setDesc(sanitizeHTMLToDom(
        'Determines how the tags will be populated in the created note. <br>' +
        'CSV: Comma-separeted tags e.g. <code>tag1, tag2, tag3</code> <br>' +
        'Hashtags: Space-separeted hashtags<code>#tag1 #tag2 #tag3</code> <br>'
      ))
      .addDropdown(async (dropdown) => {
        dropdown.addOption('csv', 'CSV');
        dropdown.addOption('hashtag', 'Hashtags');
        dropdown.setValue(this.plugin.settings.tagFormat);
        dropdown.onChange(async (value) => {
          this.plugin.settings.tagFormat = value;
          await this.plugin.saveSettings();
        });
      });
    this.authenticationSettings();
  }

  private addTextSetting = (setting: TextSetting, el: HTMLElement): void => {
    const result = new Setting(el)
      .setName(setting.name)
      .setDesc(setting.desc)
      .addText((text) => {
        text
          .setValue(setting.get())
          .onChange(async (value) => {
            setting.set(value);
          });
      });
    if (setting.class) {
      result.setClass(setting.class);
    }
  };

  private addTextSettingHere = (setting: TextSetting): void => {
    this.addTextSetting(setting, this.containerEl);
  };

  private updateSetting = (key: keyof WallabagSettings): ((v: string) => void) => async (v: string) => {
    this.plugin.settings[key] = v;
    await this.plugin.saveSettings();
  };

  private authenticationSettings() {
    this.containerEl.createEl('h2', { text: 'Authentication' });

    let clientId = '', clientSecret = '', username = '', password = '';

    if (this.isAuthenticated()) {
      this.containerEl.createEl('strong', { text: 'You are currently authenticated, to change authentication settings, logout first.'});
    }

    const authenticationClass = this.isAuthenticated() ? 'wallabag-setting-hidden' : 'wallabag-setting-shown';

    ([
      {
        name: 'Client ID',
        desc: 'Wallabag client id',
        get: () => '',
        set: v => clientId = v,
        class: authenticationClass
      },
      {
        name: 'Client Secret',
        desc: 'Wallabag client secret',
        get: () => '',
        set: v => clientSecret = v,
        class: authenticationClass
      },
      {
        name: 'Username',
        desc: 'Wallabag username',
        get: () => '',
        set: v => username = v,
        class: authenticationClass
      },
      {
        name: 'Password',
        desc: 'Wallabag Password',
        get: () => '',
        set: v => password = v,
        class: authenticationClass
      }
    ] as TextSetting[]).forEach(this.addTextSettingHere);

    new Setting(this.containerEl).addButton((button) => {
      button
        .setButtonText(this.isAuthenticated() ? 'Logout' : 'Authenticate')
        .setClass(this.isAuthenticated() ? 'mod-warning' : 'mod-cta')
        .onClick(async () => {
          if (this.isAuthenticated()) {
            await this.plugin.onLogout();
            this.display();
          } else {
            const notice = new Notice('Authenticating with Wallabag...');
            try {
              await WallabagAPI.authenticate(this.plugin.settings.serverUrl, clientId, clientSecret, username, password).then(async (token) => {
                await this.plugin.onAuthenticated(token);
                this.display();
                notice.setMessage('Authenticated with Wallabag.');
              });
            } catch (error) {
              console.log(error);
              notice.setMessage('Authentication with Wallabag failed.');
            }
          }
        });
    });
  }

}
