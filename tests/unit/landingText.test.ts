import { describe, expect, it } from 'vitest';
import { formatCfpDescription } from '../../src/web/landingText';

describe('landing text formatting', () => {
  it('formats a topic heading, intro, and line-based CFP topics', () => {
    const result = formatCfpDescription(`Topics for Talks

We accept submissions on the following topics:

Advanced Exploitation Techniques
Zero-Day Vulnerability Research
Reverse Engineering Methodologies`);

    expect(result).toEqual({
      intro: 'We accept submissions on the following topics:',
      paragraphs: [],
      listItems: ['Advanced Exploitation Techniques', 'Zero-Day Vulnerability Research', 'Reverse Engineering Methodologies']
    });
  });

  it('keeps single-paragraph CFP text as plain paragraphs', () => {
    expect(formatCfpDescription('Submit deep technical proposals.')).toEqual({
      intro: null,
      paragraphs: ['Submit deep technical proposals.'],
      listItems: []
    });
  });
});
