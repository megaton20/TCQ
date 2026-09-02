const { sequelize, Wallet, Vote, Contestant, Edition, Transaction } = require('../models');
const { emitAdminFeed } = require('../utils/adminFeed');

// 1 vote = 1 coin. Coins only convert to naira when a bundle is purchased
// (see walletService/coinBundle: 1 coin = ₦200), so once coins are in a
// wallet, spending them on votes is a straight 1-for-1 deduction.
const COINS_PER_VOTE = 1;

class InsufficientCoinsError extends Error {}

/**
 * Casts votes for a contestant, deducting coins from the voter's wallet
 * inside a DB transaction, then broadcasts live updates over sockets.
 *
 * @param {Object} io - the Socket.io server instance (req.app.get('io'))
 * @param {string} userId
 * @param {string} contestantId
 * @param {number} voteCount - how many votes this action represents
 * @param {'quick'|'manual'} method
 */
async function castVote(io, userId, contestantId, voteCount, method = 'manual') {
  if (!Number.isInteger(voteCount) || voteCount < 1) {
    throw new Error('Vote count must be a positive whole number.');
  }

  const coinsSpent = voteCount * COINS_PER_VOTE;

  const result = await sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!wallet) throw new Error('Wallet not found.');
    if (Number(wallet.coinBalance) < coinsSpent) {
      throw new InsufficientCoinsError('Not enough coins for this vote. Please top up your wallet.');
    }

    // Postgres won't allow FOR UPDATE on a query that outer-joins a
    // nullable relation (Edition here, since editionId could in theory be
    // null) - "FOR UPDATE cannot be applied to the nullable side of an
    // outer join". So lock the Contestant row on its own, then look up its
    // Edition separately (no lock needed - we're only reading a boolean,
    // and editions aren't concurrently modified during a vote).
    const contestant = await Contestant.findByPk(contestantId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!contestant || contestant.status !== 'approved') {
      throw new Error('This contestant is not open for voting.');
    }

    const edition = await Edition.findByPk(contestant.editionId, { transaction: t });
    if (!edition || !edition.isCurrent) {
      throw new Error('Voting has closed for this edition. Only the current edition can be voted on.');
    }

    wallet.coinBalance = Number(wallet.coinBalance) - coinsSpent;
    await wallet.save({ transaction: t });

    const vote = await Vote.create({
      userId,
      contestantId,
      editionId: contestant.editionId,
      voteCount,
      coinsSpent,
      method
    }, { transaction: t });

    contestant.voteCount = Number(contestant.voteCount) + voteCount;
    contestant.coinsEarned = Number(contestant.coinsEarned) + coinsSpent;
    await contestant.save({ transaction: t });

    await Transaction.create({
      userId,
      type: 'vote_spend',
      voteId: vote.id,
      coinAmount: coinsSpent,
      status: 'success'
    }, { transaction: t });

    return { vote, contestant, walletBalance: wallet.coinBalance };
  });

  // Broadcast after the DB transaction commits successfully
  io.to(`contestant:${contestantId}`).emit('vote:new', {
    contestantId,
    editionId: result.contestant.editionId,
    contestantVoteCount: Number(result.contestant.voteCount),
    voteCountAdded: voteCount
  });

  const leaderboard = await Contestant.findAll({
    where: { editionId: result.contestant.editionId, status: 'approved' },
    order: [['voteCount', 'DESC']],
    limit: 20,
    attributes: ['id', 'fullName', 'slug', 'contestantNumber', 'voteCount']
  });

  io.to(`leaderboard:${result.contestant.editionId}`).emit('leaderboard:update', {
    editionId: result.contestant.editionId,
    contestants: leaderboard
  });

  // No money figures here deliberately - vote counts are already public on
  // the leaderboard, so this is fine for the general admin feed too.
  emitAdminFeed(io, {
    type: 'vote',
    message: `${voteCount} vote(s) cast for ${result.contestant.fullName}`,
    meta: { contestantId, contestantName: result.contestant.fullName, voteCount }
  });

  return result;
}

module.exports = { castVote, InsufficientCoinsError, COINS_PER_VOTE };
