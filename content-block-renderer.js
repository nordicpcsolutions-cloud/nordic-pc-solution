/*
 * content-block-renderer.js — EXTENSIBLE BLOCK RENDERING SYSTEM
 *
 * CONTENT BLOCKS ARCHITECTURE
 * ============================
 * Articles are stored as an ordered array of typed content blocks in
 * blog_posts.content_blocks (jsonb column).
 * Each block: { id: string, type: string, data: object }
 * The 'data' shape is entirely determined by 'type' — this file's job is
 * to look up the correct render function for each block's type and call it
 * with that block's data.
 *
 * TO ADD A NEW BLOCK TYPE IN THE FUTURE:
 * 1. Write a new render function: function renderXBlock(data) { return '...html...'; }
 * 2. Register it in BLOCK_RENDERERS: { ..., x: renderXBlock }
 * 3. That's it — no changes needed anywhere else in this file, the editor,
 *    or existing articles.
 *
 * Requires markdown-renderer.js to be loaded first (renderMarkdown is used
 * by the 'markdown' block type).
 */

var BLOCK_RENDERERS = {
  markdown: function(data) {
    return renderMarkdown(data.markdown || '');
  }
  // Future block types get added here:
  // image, gallery, youtube, callout, faq, comparison_table,
  // pros_cons, cta, related_articles, code, etc.
};

function renderContentBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return blocks.map(function(block) {
    var renderer = BLOCK_RENDERERS[block.type];
    if (!renderer) {
      console.warn('[content-blocks] Unknown block type "' + block.type + '", skipping block id:', block.id);
      return '';
    }
    try {
      return '<div class="content-block content-block-' + block.type + '">' +
             renderer(block.data || {}) +
             '</div>';
    } catch(e) {
      console.error('[content-blocks] Error rendering block id:', block.id, e);
      return ''; // one broken block must never crash the whole article render
    }
  }).join('\n');
}

// Generates a stable unique id for a new block created client-side.
// The editor calls this when building a brand-new block that has no id yet.
// Once a block has been saved to the DB its id is preserved on every subsequent
// save, so any future feature that references blocks by id remains stable.
function generateBlockId() {
  return 'block-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}
