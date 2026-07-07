/**
 * markdown-renderer.js — SHARED CMS RENDERING PIPELINE
 *
 * This is the SINGLE markdown rendering pipeline for the entire Nordic PC Solutions CMS.
 * It is used by: Blog, Portfolio, Case Studies, Guides, and any future content type
 * that requires markdown rendering. Do NOT duplicate this logic per content type —
 * always call renderMarkdown() from this file.
 *
 * REQUIRED DEPENDENCIES (add these <script> tags to the HTML page BEFORE this file):
 *   <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
 *
 * USAGE:
 *   const html   = renderMarkdown(markdownString);
 *   const stats  = getContentStats(markdownString);
 *   // stats → { wordCount, charCount, readingTimeMinutes }
 */

/**
 * Converts a markdown string to sanitized HTML.
 * Pipeline: markdown → marked.parse() → DOMPurify.sanitize() → clean HTML string.
 *
 * @param {string} markdownText
 * @returns {string} Sanitized HTML safe for innerHTML insertion.
 */
function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  marked.setOptions({
    gfm: true,       // GitHub-flavored markdown: tables, strikethrough, task lists
    breaks: false,   // Require two newlines for paragraph breaks (standard markdown)
    headerIds: false // Omit id attributes on headings (avoid id collisions on pages with multiple articles)
  });

  const rawHtml = marked.parse(markdownText);

  // Allowlist covers all standard GFM output elements.
  // Intentionally excludes: script, style, iframe, form, input, object, embed.
  // rel="noopener noreferrer" enforcement for external links is handled downstream
  // via article-typography.css (a[target="_blank"]) — not here, since DOMPurify
  // would strip a rel attribute we add, but FORCE_ATTR can't conditionally target.
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      // Block structure
      'h1','h2','h3','h4','h5','h6',
      'p','br','hr','blockquote',
      'ul','ol','li',
      'pre','code',
      'table','thead','tbody','tfoot','tr','th','td',
      'figure','figcaption',
      // Inline
      'strong','em','b','i','s','del','mark','sup','sub','span',
      // Media & links
      'a','img',
    ],
    ALLOWED_ATTR: [
      'href','src','alt','title','target','rel',
      'width','height',                   // img sizing
      'colspan','rowspan',                // table layout
      'class',                            // allow class for syntax-highlighted code blocks (future)
    ],
    // Strip data: URIs from src/href to prevent data-URI-based XSS
    ALLOW_DATA_ATTR: false,
  });

  return cleanHtml;
}

/**
 * Returns word count, character count, and estimated reading time for a markdown string.
 * Counts raw markdown text (not the rendered HTML) so formatting characters don't
 * artificially inflate word counts.
 *
 * @param {string} markdownText
 * @returns {{ wordCount: number, charCount: number, readingTimeMinutes: number }}
 */
function getContentStats(markdownText) {
  const text      = (markdownText || '').trim();
  const words     = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;
  // ~200 wpm is a conservative average reading speed; minimum 1 minute
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
  return { wordCount, charCount, readingTimeMinutes };
}
