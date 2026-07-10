// content-utils.js — shared public-page content logic.
// incrementArticleView() was originally placed in admin-shared.js for convenience
// but belongs here since it is public-page logic (called on article reads, not in
// admin sessions). Public pages load content-utils.js directly without admin-shared.js.
// Kept separate from admin-shared.js because public pages (blogg.html, future
// portfolio/guides pages) should not pull in admin/auth dependencies.
// These functions operate on already-loaded arrays of post-like objects and
// never call Supabase directly, making them reusable across any content type
// that provides the minimal shape: { id, category_id, created_at, tagIds[] }.

// ────────────────────────────────────────────────────────────────────
// VIEW COUNTER
// ────────────────────────────────────────────────────────────────────

/**
 * Increments the view count for a blog post, at most once per 24 hours per browser.
 * localStorage key prevents re-counting on same-tab refresh or quick return visits.
 *
 * @param {string|number} postId          — the blog_posts.id value
 * @param {object}        supabaseClient  — initialised Supabase JS v2 client instance
 */
async function incrementArticleView(postId, supabaseClient) {
  var storageKey   = 'viewed_post_' + postId;
  var storedEntry  = localStorage.getItem(storageKey);
  var now          = Date.now();
  var TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
  if (storedEntry) {
    var lastViewed = parseInt(storedEntry, 10);
    if (!isNaN(lastViewed) && now - lastViewed < TWENTY_FOUR_H) return;
  }
  localStorage.setItem(storageKey, String(now));
  var res = await supabaseClient.from('blog_posts').select('views').eq('id', postId).single();
  var newViews = ((res.data && res.data.views) || 0) + 1;
  await supabaseClient.from('blog_posts')
    .update({ views: newViews, last_viewed_at: new Date().toISOString() })
    .eq('id', postId);
}

// ────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────

/**
 * Returns up to `limit` related posts for `currentPost`.
 *
 * Manual mode: uses currentPost.manual_related_ids (in order); falls back to
 * auto-fill for any slots below the limit that aren't covered by manual picks.
 * Auto mode: 3-tier scoring — shared tags → same category → most recent.
 *
 * Prerequisites the caller must satisfy BEFORE calling this function:
 *   - currentPost.tagIds  — array of tag id values for the current post
 *   - each candidate in allPublishedPosts must also have a .tagIds array
 *   Populate these via a join query against blog_post_tags (or equivalent).
 *
 * @param {object}   currentPost       — the post being viewed
 * @param {object[]} allPublishedPosts — all published posts (including currentPost)
 * @param {number}   [limit=4]         — max results to return
 * @returns {Promise<object[]>}
 */
async function getRelatedArticles(currentPost, allPublishedPosts, limit) {
  limit = limit !== undefined ? limit : 4;

  if (
    currentPost.related_articles_mode === 'manual' &&
    currentPost.manual_related_ids &&
    currentPost.manual_related_ids.length > 0
  ) {
    var manualPicks = currentPost.manual_related_ids
      .map(function(id) {
        return allPublishedPosts.find(function(p) { return String(p.id) === String(id); });
      })
      .filter(Boolean); // drop picks that no longer exist or aren't published

    if (manualPicks.length >= limit) return manualPicks.slice(0, limit);

    // Manual picks don't fill the limit — auto-fill remaining slots
    var remaining   = limit - manualPicks.length;
    var excludeIds  = manualPicks.map(function(p) { return p.id; });
    var autoFill    = await getAutoRelated(currentPost, allPublishedPosts, remaining, excludeIds);
    return manualPicks.concat(autoFill);
  }

  return getAutoRelated(currentPost, allPublishedPosts, limit, []);
}

// ────────────────────────────────────────────────────────────────────
// INTERNAL
// ────────────────────────────────────────────────────────────────────

/**
 * 3-tier automatic related-post ranking:
 *   Tier 1 — articles sharing the most tags with currentPost (descending count)
 *   Tier 2 — articles in the same category not already in tier 1
 *   Tier 3 — most recently published articles not already included
 *
 * Never returns the currentPost itself or any id in excludeIds.
 * Returns fewer than `limit` only if the total pool is smaller than `limit`.
 *
 * @param {object}   currentPost
 * @param {object[]} allPublishedPosts
 * @param {number}   limit
 * @param {Array}    excludeIds — ids (any type) to exclude beyond currentPost
 * @returns {Promise<object[]>}
 */
async function getAutoRelated(currentPost, allPublishedPosts, limit, excludeIds) {
  excludeIds = excludeIds || [];

  var candidates = allPublishedPosts.filter(function(p) {
    if (String(p.id) === String(currentPost.id)) return false;
    return !excludeIds.some(function(id) { return String(id) === String(p.id); });
  });

  var currentTagIds = new Set((currentPost.tagIds || []).map(String));

  var scored = candidates.map(function(post) {
    var postTagIds     = new Set((post.tagIds || []).map(String));
    var sharedTagCount = 0;
    currentTagIds.forEach(function(t) { if (postTagIds.has(t)) sharedTagCount++; });
    return {
      post:           post,
      sharedTagCount: sharedTagCount,
      sameCategory:   post.category_id === currentPost.category_id,
    };
  });

  // Tier 1: shared tags, highest count first
  var byTags = scored
    .filter(function(s) { return s.sharedTagCount > 0; })
    .sort(function(a, b) { return b.sharedTagCount - a.sharedTagCount; })
    .map(function(s) { return s.post; });

  var result = byTags.slice(0, limit);

  // Tier 2: same category, not already included
  if (result.length < limit) {
    var resultIds = new Set(result.map(function(p) { return String(p.id); }));
    var byCat = scored
      .filter(function(s) { return s.sameCategory && !resultIds.has(String(s.post.id)); })
      .map(function(s) { return s.post; });
    result = result.concat(byCat).slice(0, limit);
  }

  // Tier 3: most recent, not already included
  if (result.length < limit) {
    var resultIds = new Set(result.map(function(p) { return String(p.id); }));
    var byRecent = candidates
      .filter(function(p) { return !resultIds.has(String(p.id)); })
      .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    result = result.concat(byRecent).slice(0, limit);
  }

  return result;
}
