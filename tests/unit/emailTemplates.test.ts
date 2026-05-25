import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../src/server/email/templates.js';

describe('email templates', () => {
  it('escapes interpolation and reports missing variables', () => {
    const missing = renderTemplate(
      { subject: 'Hi {{name}}', html_body: '<p>{{name}}</p>', text_body: 'Hi {{name}}', required_variables: ['name'] },
      {}
    );
    expect(missing.ok).toBe(false);

    const rendered = renderTemplate(
      { subject: 'Hi {{name}}', html_body: '<p>{{name}}</p>', text_body: 'Hi {{name}}', required_variables: ['name'] },
      { name: '<script>alert(1)</script>' }
    );
    expect(rendered.ok).toBe(true);
    if (rendered.ok) {
      expect(rendered.htmlBody).not.toContain('<script>');
      expect(rendered.textBody).toContain('<script>alert(1)</script>');
    }
  });
});
