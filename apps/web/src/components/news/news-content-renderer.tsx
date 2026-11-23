'use client';

import React from 'react';
import { sanitizeSafeUrl } from '@/lib/format';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={`b-${keyCounter++}`} className="font-semibold text-[var(--text-primary)]">
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <em key={`i-${keyCounter++}`} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={`c-${keyCounter++}`}
          className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-xs font-mono"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5] !== undefined && match[6] !== undefined) {
      const safeHref = sanitizeSafeUrl(match[6], true);
      if (safeHref) {
        const isExternal = safeHref.startsWith('http');
        nodes.push(
          <a
            key={`a-${keyCounter++}`}
            href={safeHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="font-medium text-[var(--accent-primary)] underline underline-offset-2 hover:opacity-85"
          >
            {match[5]}
          </a>,
        );
      } else {
        nodes.push(match[5]);
      }
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes;
}

export function NewsContentRenderer({ content }: { content: string }) {
  const blocks = (content || '').split(/\n\n+/);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-[var(--text-primary)]">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="font-serif text-lg font-bold text-[var(--text-primary)] pt-2">
              {renderInlineMarkdown(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] pt-3">
              {renderInlineMarkdown(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-[var(--accent-primary)] bg-[var(--bg-subtle)]/60 px-4 py-3 italic text-[var(--text-secondary)] rounded-r-xl"
            >
              {renderInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }
        if (trimmed.startsWith('![')) {
          const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (match) {
            const safeSrc = sanitizeSafeUrl(match[2], true);
            if (!safeSrc) return null;
            return (
              <figure key={idx} className="my-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                <img src={safeSrc} alt={match[1]} className="w-full object-cover" />
                {match[1] && (
                  <figcaption className="bg-[var(--bg-subtle)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
                    {match[1]}
                  </figcaption>
                )}
              </figure>
            );
          }
        }
        if (trimmed.split('\n').every((line) => line.trim().startsWith('- '))) {
          return (
            <ul key={idx} className="list-disc space-y-1.5 pl-5 text-[var(--text-secondary)]">
              {trimmed.split('\n').map((line, lIdx) => (
                <li key={lIdx}>{renderInlineMarkdown(line.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-line text-[var(--text-secondary)] leading-relaxed">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
