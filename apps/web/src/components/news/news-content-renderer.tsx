'use client';

import React from 'react';

interface NewsContentRendererProps {
  content: string;
}

export function NewsContentRenderer({ content }: NewsContentRendererProps) {
  if (!content) return null;

  // 1. Normalize line endings (\r\n -> \n)
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Split content by double newlines into blocks
  const blocks = normalized.split(/\n\n+/);

  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200 leading-relaxed text-sm sm:text-base">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const elements = parseBlockMarkdown(trimmed);
        return <div key={index}>{elements}</div>;
      })}
    </div>
  );
}

function parseBlockMarkdown(text: string): React.ReactNode[] {
  // 1. Headings
  if (text.startsWith('# ')) {
    return [
      <h1 key="h1" className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-6 mb-3">
        {text.replace(/^#\s+/, '')}
      </h1>,
    ];
  }
  if (text.startsWith('## ')) {
    return [
      <h2 key="h2" className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mt-5 mb-2">
        {text.replace(/^##\s+/, '')}
      </h2>,
    ];
  }
  if (text.startsWith('### ')) {
    return [
      <h3 key="h3" className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mt-4 mb-2">
        {text.replace(/^###\s+/, '')}
      </h3>,
    ];
  }

  // 2. Blockquotes
  if (text.startsWith('> ')) {
    return [
      <blockquote
        key="bq"
        className="my-4 border-l-4 border-violet-500 bg-violet-500/5 dark:bg-violet-500/10 p-4 rounded-r-xl italic text-zinc-700 dark:text-zinc-300"
      >
        {text.replace(/^>\s+/, '')}
      </blockquote>,
    ];
  }

  // 3. Parse Markdown images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.substring(lastIndex, match.index);
      if (textPart) {
        elements.push(<span key={`txt-${lastIndex}`}>{parseFormattedText(textPart)}</span>);
      }
    }

    const alt = match[1]?.trim() || '';
    const src = match[2]?.trim() || '';

    if (src) {
      elements.push(
        <figure key={`img-${match.index}`} className="my-6 flex flex-col items-center justify-center">
          <img
            src={src}
            alt={alt || 'Hình ảnh tin tức'}
            className="max-h-[550px] w-auto max-w-full rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-lg object-contain"
          />
          {alt && <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400 italic">{alt}</figcaption>}
        </figure>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const textPart = text.substring(lastIndex);
    if (textPart) {
      elements.push(<span key={`txt-${lastIndex}`}>{parseFormattedText(textPart)}</span>);
    }
  }

  return elements;
}

function parseFormattedText(text: string): React.ReactNode {
  // Regex to split by **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-zinc-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
