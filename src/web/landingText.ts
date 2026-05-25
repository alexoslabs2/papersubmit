export interface FormattedCfpDescription {
  intro: string | null;
  paragraphs: string[];
  listItems: string[];
}

const topicHeadingPattern = /^(topics|t[oó]picos)(\s+(for|para)\s+.+)?$/i;

export function formatCfpDescription(value: string | null | undefined): FormattedCfpDescription {
  const lines = (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && topicHeadingPattern.test(lines[0])) {
    lines.shift();
  }

  if (lines.length < 2) {
    return { intro: null, paragraphs: lines, listItems: [] };
  }

  return {
    intro: lines[0],
    paragraphs: [],
    listItems: lines.slice(1)
  };
}
