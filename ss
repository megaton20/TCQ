const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const walletService = require('../services/walletService');
const ticketService = require('../services/ticketService');

// Paystack webhook - using raw body parser
router.post('/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    
    let rawBody = req.body;
    
    // Ensure rawBody is a Buffer
    if (!Buffer.isBuffer(rawBody)) {
      // If it's a string, convert to Buffer
      if (typeof rawBody === 'string') {
        rawBody = Buffer.from(rawBody, 'utf8');
      } 
      // If it's an object, stringify and convert to Buffer
      else if (typeof rawBody === 'object') {
        rawBody = Buffer.from(JSON.stringify(rawBody), 'utf8');
      } else {
        // Fallback - if it's neither, try to convert
        rawBody = Buffer.from(String(rawBody), 'utf8');
      }
    }

    // Create HMAC hash using the raw body Buffer
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    // Verify signature
    if (hash !== signature) {
      console.log('Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }

    // Parse the raw body to JSON (handle both Buffer and string)
    let event;
    if (Buffer.isBuffer(rawBody)) {
      event = JSON.parse(rawBody.toString());
    } else if (typeof rawBody === 'string') {
      event = JSON.parse(rawBody);
    } else {
      event = rawBody; // Already an object
    }

    const reference = event.data?.reference;
    const purpose = event.data?.metadata?.purpose;
    const io = req.app.get('io');

    console.log(`Webhook received: ${event.event} - ${purpose || 'unknown purpose'}`);

    // Handle different events
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
        console.log(` Unhandled purpose for failed charge: ${purpose}`);
      }
    } else {
      console.log(`Unhandled event type: ${event.event}`);
    }

    res.sendStatus(200);
    
  } catch (err) {
    console.error('Webhook error:', err);
    // Always send 200 to acknowledge receipt, even on error
    res.sendStatus(200);
  }
});

module.exports = router;