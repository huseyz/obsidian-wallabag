import { WallabagArticle } from 'wallabag/WallabagAPI';
import { htmlToMarkdown } from 'obsidian';

export default class NoteTemplate {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  fill(wallabagArticle: WallabagArticle, serverBaseUrl: string, convertHtmlToMarkdown: string, tagFormat: string, pdfLink = ''): string {
    const content = wallabagArticle.content !== null ? wallabagArticle.content : '';
    const annotations = wallabagArticle.annotations.map(a => '> ' + a.quote + (a.text ? '\n\n' + a.text : '')).join('\n\n');
    const variables: {[key: string]: string} = {
      '{{id}}': wallabagArticle.id.toString(),
      '{{article_title}}': wallabagArticle.title,
      '{{original_link}}': wallabagArticle.url,
      '{{created_at}}': wallabagArticle.createdAt,
      '{{published_at}}': wallabagArticle.publishedAt,
      '{{updated_at}}': wallabagArticle.updatedAt,
      '{{wallabag_link}}': `${serverBaseUrl}/view/${wallabagArticle.id}`,
      '{{content}}': convertHtmlToMarkdown === 'true' ? htmlToMarkdown(content) : content,
      '{{pdf_link}}': pdfLink,
      '{{tags}}': this.formatTags(wallabagArticle.tags, tagFormat),
      '{{reading_time}}': wallabagArticle.readingTime,
      '{{preview_picture}}': wallabagArticle.previewPicture,
      '{{domain_name}}': wallabagArticle.domainName,
      '{{annotations}}': annotations
    };
    let noteContent = this.content;
    Object.keys(variables).forEach((key) => {
      noteContent = noteContent.replaceAll(key, variables[key]);
    });
    return noteContent;
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
