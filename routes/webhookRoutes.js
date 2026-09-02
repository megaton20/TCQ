const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const walletService = require('../services/walletService');
const ticketService = require('../services/ticketService');

// Paystack sends raw JSON; we verify the signature using the raw body, so
// this route needs its own body parser instance ahead of express.json() -
// see app.js, where this router is deliberately mounted before ANY other
// middleware for exactly this reason.
router.post('/paystack', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    let rawBody = req.body;

    // Defensive normalization: req.body SHOULD already be a Buffer thanks
    // to express.raw() above, but if anything upstream ever ends up
    // touching it first (a stale copy of app.js, a host/proxy that
    // pre-parses bodies, etc.), coerce whatever we got into a Buffer
    // rather than crashing crypto.createHmac().update() outright.
    if (!Buffer.isBuffer(rawBody)) {
      if (typeof rawBody === 'string') {
        rawBody = Buffer.from(rawBody, 'utf8');
      } else if (rawBody && typeof rawBody === 'object') {
        rawBody = Buffer.from(JSON.stringify(rawBody), 'utf8');
      } else {
        rawBody = Buffer.from(String(rawBody || ''), 'utf8');
      }
    }

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Webhook signature mismatch - rejecting.');
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString());
    const reference = event.data?.reference;
    const purpose = event.data?.metadata?.purpose;
    const io = req.app.get('io');

    console.log(`Webhook received: ${event.event} - ${purpose || 'unknown purpose'}`);

    if (event.event === 'charge.success') {
      if (purpose === 'bundle_purchase') {
        await walletService.confirmBundlePurchase(io, reference);
      } else if (purpose === 'ticket_purchase') {
        await ticketService.confirmTicketPurchase(io, reference);
      } else {
        console.log(`Unhandled purpose: ${purpose}`);
      }
    } else if (event.event === 'charge.failed') {
      if (purpose === 'bundle_purchase') {
        await walletService.markBundlePurchaseFailed(reference);
      } else if (purpose === 'ticket_purchase') {
        await ticketService.markTicketPurchaseFailed(reference);
      } else {
        console.log(`Unhandled purpose for failed charge: ${purpose}`);
      }
    } else {
      console.log(`Unhandled event type: ${event.event}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200); // acknowledge anyway so Paystack doesn't hammer retries; log for manual follow-up
  }
});

module.exports = router;
