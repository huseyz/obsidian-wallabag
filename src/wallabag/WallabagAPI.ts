import WallabagPlugin from 'main';
import { request, requestUrl, RequestUrlResponse } from 'obsidian';
import { Token } from './WallabagAuth';

interface WallabagAnnotation {
  user: string,
  annotator_schema_version: string,
  id: number,
  text: string,
  created_at: string,
  updated_at: string,
  quote: string,
}

export interface WallabagArticle {
  id: number,
  tags: string[],
  title: string,
  url: string,
  content: string,
  createdAt: string,
  publishedAt: string;
  updatedAt: string;
  readingTime: string,
  previewPicture: string,
  domainName: string
  annotations: WallabagAnnotation[]
}

export interface WallabagArticlesResponse {
  page: number,
  pages: number,
  articles: WallabagArticle[]
}

export default class WallabagAPI {
  plugin: WallabagPlugin;
  token: Token;

  constructor(token: Token, plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.token = token;
  }

  static async authenticate(
    serverUrl: string,
    clientId: string,
    clientSecret: string,
    username: string,
    password: string
  ): Promise<Token> {
    const body = {
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password
    };

    const requestOptions = {
      url: `${serverUrl}/oauth/v2/token`,
      method: 'POST',
      body: JSON.stringify(body),
      contentType: 'application/json',
    };

    const response = await requestUrl(requestOptions);
    const parsed = response.json;

    return {
      clientId,
      clientSecret,
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
    };
  }

  async refresh(): Promise<Token> {
    return request({
      url: `${this.plugin.settings.serverUrl}/oauth/v2/token`,
      method: 'POST',
      body: `grant_type=refresh_token&refresh_token=${this.token.refreshToken}&client_id=${this.token.clientId}&client_secret=${this.token.clientSecret}`,
      contentType: 'application/x-www-form-urlencoded',
    }).then((response) => {
      const parsed = JSON.parse(response);
      return {
        clientId: this.token.clientId,
        clientSecret: this.token.clientSecret,
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
      };
    });
  }

  private convertWallabagArticle(article: any) {
    return {
      id: article['id'],
      tags: article['tags'].map((tag: any) => tag['slug']),
      title: article['title'],
      url: article['url'],
      content: article['content'],
      createdAt: article['created_at'],
      updatedAt: article['updated_at'],
      publishedAt: article['published_at'],
      readingTime: article['reading_time'],
      previewPicture: article['preview_picture'],
      domainName: article['domain_name'],
      annotations: article['annotations'],
    };
  }

  private convertWallabagArticlesResponse(response: RequestUrlResponse): WallabagArticlesResponse {
    return {
      page: response.json['page'],
      pages: response.json['pages'],
      articles: response.json['_embedded']['items'].map(this.convertWallabagArticle)
    };
  }

  private async tokenRefreshingFetch(url: string, method?: string, body?: string): Promise<RequestUrlResponse> {
    return requestUrl({
      url: url,
      headers: {
        'Authorization': `Bearer ${this.token.accessToken}`,
        'Content-Type': 'application/json'
      },
      method: method ? method : 'GET',
      body: body
    }).catch(async (reason) => {
      if (reason.status === 401) {
        console.log('Likely the token expired, refreshing it.');
        return await this.refresh().then(async (token) => {
          this.token = token;
          await this.plugin.onAuthenticated(this.token);
          return this.tokenRefreshingFetch(url);
        }).catch(async (reason) => {
          console.log('Token refresh failed.', reason);
          await this.plugin.onTokenRefreshFailed();
          throw new Error('');
        });
      } else {
        console.log(`Something else failed ${reason}`);
        throw new Error('');
      }
    });
  }

  async fetchArticles(archive = 0, page = 1, results: WallabagArticle[] = []): Promise<WallabagArticle[]> {
    const url = `${this.plugin.settings.serverUrl}/api/entries.json?archive=${archive}&page=${page}&tags=${this.plugin.settings.tag}`;
    return this.tokenRefreshingFetch(url).then((value) => {
      const response = this.convertWallabagArticlesResponse(value);
      if (response.pages === response.page) {
        return [...results, ...response.articles];
      } else {
        return this.fetchArticles(archive, page+1, [...results, ...response.articles]);
      }
    });
  }

  async exportArticle(id: number, format = 'pdf'): Promise<ArrayBuffer> {
    const url = `${this.plugin.settings.serverUrl}/api/entries/${id}/export.${format}`;
    return this.tokenRefreshingFetch(url).then((value) => {
      return value.arrayBuffer;
    });
  }

  async archiveArticle(id: number) {
    const url = `${this.plugin.settings.serverUrl}/api/entries/${id}`;
    return this.tokenRefreshingFetch(url, 'PATCH', JSON.stringify({ archive: 1 }));
  }

}
