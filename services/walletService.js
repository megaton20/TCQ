const { sequelize, Wallet, CoinBundle, Transaction, User } = require('../models');
const paystack = require('../utils/paystack');
const { emitRevenueFeed } = require('../utils/adminFeed');

/**
 * Step 1: user picks a bundle -> we create a pending Transaction and get a
 * Paystack checkout URL. Split code IS applied here so the developer's
 * share is routed automatically on settlement.
 */
async function initiateBundlePurchase(userId, coinBundleId, callbackUrl) {
  const user = await User.findByPk(userId);
  const bundle = await CoinBundle.findByPk(coinBundleId);
  if (!bundle || !bundle.isActive) throw new Error('This coin bundle is not available.');

  const paystackTx = await paystack.initializeTransaction({
    email: user.email,
    amountNaira: Number(bundle.priceNaira),
    callbackUrl,
    splitCode: process.env.PAYSTACK_VOTE_SPLIT_CODE, // developer split ONLY on bundle purchases
    metadata: { userId, coinBundleId, purpose: 'bundle_purchase' }
  });

  await Transaction.create({
    userId,
    type: 'bundle_purchase',
    coinBundleId,
    amountNaira: bundle.priceNaira,
    coinAmount: bundle.coinAmount,
    paystackReference: paystackTx.reference,
    splitCodeApplied: process.env.PAYSTACK_VOTE_SPLIT_CODE,
    status: 'pending'
  });

  return paystackTx; // { authorization_url, reference }
}

/**
 * Step 2: called from the Paystack webhook once payment is confirmed.
 * Credits coins to the wallet. Idempotent - safe to call twice for the
 * same reference.
 *
 * @param {Object} io - Socket.io server instance, used to notify the
 *   superadmin revenue feed (a bundle purchase is a money event).
 */
async function confirmBundlePurchase(io, reference) {
  const txn = await sequelize.transaction(async (t) => {
    const found = await Transaction.findOne({
      where: { paystackReference: reference, type: 'bundle_purchase' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!found) throw new Error(`No matching bundle transaction for reference ${reference}`);
    if (found.status === 'success') return found; // already processed, no-op

    const wallet = await Wallet.findOne({ where: { userId: found.userId }, transaction: t, lock: t.LOCK.UPDATE });
    wallet.coinBalance = Number(wallet.coinBalance) + Number(found.coinAmount);
    await wallet.save({ transaction: t });

    found.status = 'success';
    await found.save({ transaction: t });

    return found;
  });

  if (io && txn.status === 'success') {
    const [user, bundle] = await Promise.all([
      User.findByPk(txn.userId),
      txn.coinBundleId ? CoinBundle.findByPk(txn.coinBundleId) : null
    ]);
    emitRevenueFeed(io, {
      type: 'bundle_purchase',
      message: `${user ? user.fullName : 'A voter'} bought the ${bundle ? bundle.name : 'coin bundle'} (+${Number(txn.coinAmount).toLocaleString()} coins)`,
      amountNaira: Number(txn.amountNaira),
      meta: { userId: txn.userId, coinBundleId: txn.coinBundleId }
    });
  }

  return txn;
}

async function markBundlePurchaseFailed(reference) {
  await Transaction.update(
    { status: 'failed' },
    { where: { paystackReference: reference, type: 'bundle_purchase' } }
  );
}

module.exports = { initiateBundlePurchase, confirmBundlePurchase, markBundlePurchaseFailed };
