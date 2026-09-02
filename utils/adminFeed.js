/**
 * Two broadcast channels so the admin/superadmin split is respected even in
 * real-time updates, not just in what routes/pages render:
 *
 * - emitAdminFeed: general operational activity (votes, check-ins, new
 *   applications). Both admin and superadmin dashboards subscribe to this.
 * - emitRevenueFeed: purchases with money attached (coin bundles, tickets).
 *   Only the superadmin dashboard ever joins this room - a plain admin's
 *   dashboard script never subscribes, so this data never reaches them.
 */

function emitAdminFeed(io, { type, message, meta }) {
  io.to('admin-feed').emit('admin:feed', {
    type,
    message,
    meta: meta || {},
    timestamp: new Date().toISOString()
  });
}

function emitRevenueFeed(io, { type, message, amountNaira, meta }) {
  io.to('admin-feed-revenue').emit('admin:revenue_feed', {
    type,
    message,
    amountNaira: amountNaira || null,
    meta: meta || {},
    timestamp: new Date().toISOString()
  });
}

module.exports = { emitAdminFeed, emitRevenueFeed };
