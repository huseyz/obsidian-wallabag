import { WallabagArticle } from 'wallabag/WallabagAPI';
import { htmlToMarkdown } from 'obsidian';

export default class NoteTemplate {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  fill(wallabagArticle: WallabagArticle, serverBaseUrl: string, convertHtmlToMarkdown: string, tagFormat: string, pdfLink = ''): string {
    const variables: {[key: string]: string} = {
      '{{article_title}}': wallabagArticle.title,
      '{{original_link}}': wallabagArticle.url,
      '{{created_at}}': wallabagArticle.createdAt,
      '{{wallabag_link}}': `${serverBaseUrl}/view/${wallabagArticle.id}`,
      '{{content}}': convertHtmlToMarkdown === 'true' ? htmlToMarkdown(wallabagArticle.content) : wallabagArticle.content,
      '{{pdf_link}}': pdfLink,
      '{{tags}}': this.formatTags(wallabagArticle.tags, tagFormat),
      '{{reading_time}}': wallabagArticle.readingTime,
      '{{preview_picture}}': wallabagArticle.previewPicture,
      '{{domain_name}}': wallabagArticle.domainName
    };
    let content = this.content;
    Object.keys(variables).forEach((key) => {
      content = content.replaceAll(key, variables[key]);
    });
    return content;
  }

  private formatTags(tags: string[], tagFormat: string): string {
    switch (tagFormat) {
    case 'csv': return tags.join(', ');
    case 'hashtag': return tags.map(tag => `#${tag}`).join(' ');
    default: return '';
    }
  }
}

export const DefaultTemplate = new NoteTemplate(
  '---\ntags: {{tags}}\n---\n ## {{article_title}} []({{original_link}})[]({{wallabag_link}})\n{{content}}'
);

export const PDFTemplate = new NoteTemplate(
  '---\ntags: {{tags}}\n---\n ## {{article_title}} []({{original_link}})[]({{wallabag_link}})\nPDF: [[{{pdf_link}}]]'
);
