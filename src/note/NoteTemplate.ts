import { WallabagArticle } from 'wallabag/WallabagAPI';

export default class NoteTemplate {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  fill(wallabagArticle: WallabagArticle, serverBaseUrl: string, pdfLink = ''): string {
    const variables: {[key: string]: string} = {
      '{{article_title}}': wallabagArticle.title,
      '{{original_link}}': wallabagArticle.url,
      '{{wallabag_link}}': `${serverBaseUrl}/view/${wallabagArticle.id}`,
      '{{content}}': wallabagArticle.content,
      '{{pdf_link}}': pdfLink,
      '{{tags}}': wallabagArticle.tags.join(', ')
    };
    let content = this.content;
    Object.keys(variables).forEach((key) => {
      content = content.replaceAll(key, variables[key]);
    });
    return content;
  }
}

export const DefaultTemplate = new NoteTemplate(
  '---\ntags: {{tags}}\n---\n ## {{article_title}} []({{original_link}})[]({{wallabag_link}})\n{{content}}'
);

export const PDFTemplate = new NoteTemplate(
  '---\ntags: {{tags}}\n---\n ## {{article_title}} []({{original_link}})[]({{wallabag_link}})\nPDF: [[{{pdf_link}}]]'
);
