import { Fragment, ReactNode } from 'react';

const INLINE_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`(.+?)`|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/;
const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|\/(?!\/))/i;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${match.index}`;
    const [raw, bold, italicStar, italicUnderscore, code, linkText, linkUrl] = match;

    if (bold !== undefined) {
      nodes.push(<strong key={key}>{renderInline(bold, key)}</strong>);
    } else if (italicStar !== undefined || italicUnderscore !== undefined) {
      nodes.push(<em key={key}>{renderInline(italicStar ?? italicUnderscore, key)}</em>);
    } else if (code !== undefined) {
      nodes.push(<code key={key}>{code}</code>);
    } else if (SAFE_URL_PATTERN.test(linkUrl)) {
      const isExternal = /^https?:\/\//i.test(linkUrl);
      nodes.push(
        <a
          href={linkUrl}
          key={key}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          target={isExternal ? '_blank' : undefined}
        >
          {renderInline(linkText, key)}
        </a>
      );
    } else {
      nodes.push(raw);
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const HEADING_TAGS = ['h3', 'h4', 'h5'] as const;

/**
 * Renders a small Markdown subset (headings, bold, italic, inline code, links, line breaks) as React
 * nodes. Never produces raw HTML, so untrusted input cannot inject markup or `javascript:` links.
 */
export function renderSimpleMarkdown(source: string): ReactNode {
  const lines = source.replace(/\\n/g, '\n').split('\n');
  return lines.map((line, index) => {
    const key = String(index);
    const heading = HEADING_PATTERN.exec(line.trim());
    if (heading) {
      const HeadingTag = HEADING_TAGS[heading[1].length - 1];
      return <HeadingTag key={key}>{renderInline(heading[2], key)}</HeadingTag>;
    }

    const previousIsText = index > 0 && !HEADING_PATTERN.test(lines[index - 1].trim());
    return (
      <Fragment key={key}>
        {previousIsText ? <br /> : null}
        {renderInline(line, key)}
      </Fragment>
    );
  });
}
