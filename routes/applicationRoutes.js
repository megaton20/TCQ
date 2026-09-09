const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail, applicationStatus } = require('../middleware/auth');
const { Edition, ContestantApplication } = require('../models');
const { uploadApplicationDocs } = require('../config/cloudinary');
const { emitAdminFeed } = require('../utils/adminFeed');

const docFields = uploadApplicationDocs.fields([
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'fullLengthPhoto', maxCount: 1 },
  { name: 'idDocument', maxCount: 1 },
  { name: 'guardianConsent', maxCount: 1 }
]);


router.get('/application-notice', requireAuth, (req, res) => {
  res.render('auth/application-notice', { title: 'Application Closed' });
});


router.get('/', requireAuth, requireVerifiedEmail,applicationStatus, async (req, res, next) => {
  try {
    const currentEdition = await Edition.findOne({ where: { isCurrent: true } });
    const existing = await ContestantApplication.findOne({
      where: { userId: req.currentUser.id, editionId: currentEdition ? currentEdition.id : null }
    });
    res.render('apply', { title: 'Become a Contestant', currentEdition, existing });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireVerifiedEmail,applicationStatus, docFields, async (req, res, next) => {
  try {
    const currentEdition = await Edition.findOne({ where: { isCurrent: true } });
    if (!currentEdition) {
      req.flash('error', 'Registration is not open right now.');
      return res.redirect('/apply');
    }
    const b = req.body;
    await ContestantApplication.create({
      userId: req.currentUser.id,
      editionId: currentEdition.id,
      fullName: b.fullName,
      dateOfBirth: b.dateOfBirth,
      gender: b.gender,
      stateOfOrigin: b.stateOfOrigin,
      address: b.address,
      phone: b.phone,
      occupation: b.occupation,
      height: b.height,
      instagramHandle: b.instagramHandle,
      whyJoin: b.whyJoin,
      passportPhotoUrl: req.files?.passportPhoto?.[0]?.path,
      fullLengthPhotoUrl: req.files?.fullLengthPhoto?.[0]?.path,
      idDocumentUrl: req.files?.idDocument?.[0]?.path,
      guardianConsentUrl: req.files?.guardianConsent?.[0]?.path
    });

    emitAdminFeed(req.app.get('io'), {
      type: 'new_application',
      message: `${b.fullName} submitted a contestant application for ${currentEdition.title}`,
      meta: { editionId: currentEdition.id }
    });

    req.flash('success', 'Application submitted! We will review it and get back to you.');
    res.redirect('/apply');
  } catch (err) { next(err); }
});

module.exports = router;
