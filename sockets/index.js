/**
 * Socket.io wiring.
 *
 * Rooms:
 *  - "leaderboard:<editionId>"    -> anyone viewing the leaderboard page for an edition
 *  - "contestant:<contestantId>"  -> anyone viewing a page with that contestant's vote count
 *                                    (contestant detail, home page grids, contestants list)
 *  - "checkin:<eventId>"          -> staff check-in screens for a given event, so multiple
 *                                    scanners at different doors see live counts together
 *  - "ticket:<ticketId>"          -> the ticket owner's own ticket-view page, so it updates
 *                                    the moment staff scan/check in that ticket
 *  - "admin-feed"                 -> admin + superadmin dashboards, general operational
 *                                    activity (votes, check-ins, applications) - no money
 *  - "admin-feed-revenue"         -> superadmin dashboards ONLY, purchase/revenue events
 *
 * Events emitted by the server:
 *  - "vote:new"            { contestantId, editionId, contestantVoteCount, voteCountAdded }
 *  - "leaderboard:update"  { editionId, contestants: [{ id, fullName, voteCount, thumbnail }] }
 *  - "ticket:checked_in"   { ticketId, eventId, holderName, ticketsSoldSoFarCheckedIn }
 *  - "ticket:status_update" { ticketId }  - tells that ticket's own page to refresh
 *  - "admin:feed"          { type, message, timestamp }              -> room "admin-feed"
 *  - "admin:revenue_feed"  { type, message, amountNaira, timestamp }  -> room "admin-feed-revenue"
 */

function initSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join:leaderboard', (editionId) => socket.join(`leaderboard:${editionId}`));
    socket.on('leave:leaderboard', (editionId) => socket.leave(`leaderboard:${editionId}`));

    socket.on('join:contestant', (contestantId) => socket.join(`contestant:${contestantId}`));
    socket.on('leave:contestant', (contestantId) => socket.leave(`contestant:${contestantId}`));

    socket.on('join:checkin', (eventId) => socket.join(`checkin:${eventId}`));
    socket.on('leave:checkin', (eventId) => socket.leave(`checkin:${eventId}`));

    socket.on('join:ticket', (ticketId) => socket.join(`ticket:${ticketId}`));
    socket.on('leave:ticket', (ticketId) => socket.leave(`ticket:${ticketId}`));

    // Access to these two is enforced by which pages actually emit the
    // join event (the admin dashboard, gated server-side by requireRole),
    // not by anything socket-level - a plain admin's dashboard script never
    // joins "admin-feed-revenue" in the first place.
    socket.on('join:admin-feed', () => socket.join('admin-feed'));
    socket.on('join:admin-feed-revenue', () => socket.join('admin-feed-revenue'));
  });
}

module.exports = { initSocket };
