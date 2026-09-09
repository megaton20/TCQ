const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Edition, Contestant, ContestantImage } = require('../models');

const contestantIncludes = [{ model: ContestantImage, as: 'images', separate: true, order: [['sortOrder', 'ASC']] }];

// Gallery photos are NOT stored in the database - just drop image files
// (.jpg/.jpeg/.png/.webp) into public/gallery/ and they show up
// automatically, newest file first. No admin upload flow needed for this.
const GALLERY_DIR = path.join(__dirname, '..', 'public', 'gallery');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function readGalleryImages() {
  if (!fs.existsSync(GALLERY_DIR)) return [];
  return fs.readdirSync(GALLERY_DIR)
    .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .map(f => ({
      filename: f,
      url: `/public/gallery/${f}`,
      mtime: fs.statSync(path.join(GALLERY_DIR, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first
}

// Home: current edition contestants + last completed edition's winner/contestants
router.get('/', async (req, res, next) => {
  try {
    const currentEdition = await Edition.findOne({ where: { isCurrent: true } });
    const thisYearContestants = currentEdition
      ? await Contestant.findAll({
          where: { editionId: currentEdition.id, status: 'approved' },
          include: contestantIncludes,
          order: [['contestantNumber', 'ASC']]
        })
      : [];

    const lastEdition = await Edition.findOne({
      where: currentEdition ? { year: currentEdition.year - 1 } : {},
      order: [['year', 'DESC']]
    });
    const lastYearWinner = lastEdition
      ? await Contestant.findOne({ where: { editionId: lastEdition.id, isWinner: true }, include: contestantIncludes })
      : null;
    const lastYearRunnerUps = lastEdition
      ? await Contestant.findAll({
          where: { editionId: lastEdition.id, winnerPosition: { [Op.in]: ['1st Runner-up', '2nd Runner-up'] } },
          include: contestantIncludes,
          order: [['winnerPosition', 'ASC']] // "1st Runner-up" sorts before "2nd Runner-up" alphabetically
        })
      : [];
    const lastYearContestants = lastEdition
      ? await Contestant.findAll({ where: { editionId: lastEdition.id, status: 'approved' }, include: contestantIncludes })
      : [];

    // All-time list of crowned Queens across every edition (not just last
    // year's), newest first - a "Hall of Fame" style section.
    const pastWinners = await Contestant.findAll({
      where: { isWinner: true },
      include: [...contestantIncludes, { model: Edition, as: 'edition' }],
      order: [[{ model: Edition, as: 'edition' }, 'year', 'DESC']]
    });

    res.render('home', {
      title: 'The Carnival Queen',
      currentEdition, thisYearContestants, lastEdition, lastYearWinner, lastYearRunnerUps, lastYearContestants,
      pastWinners,
      galleryPreview: readGalleryImages().slice(0, 8)
    });
  } catch (err) { next(err); }
});

router.get('/about', (req, res) => res.render('about', { title: 'About Us' }));
router.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us' }));
router.get('/contact/dev', (req, res) => res.render('contact-dev', { title: 'Contact developer' }));

router.get('/gallery', (req, res) => {
  res.render('gallery', { title: 'Gallery', images: readGalleryImages() });
});

router.get('/contestants', async (req, res, next) => {
  try {
    const currentEdition = await Edition.findOne({ where: { isCurrent: true } });
    const contestants = currentEdition
      ? await Contestant.findAll({
          where: { editionId: currentEdition.id, status: 'approved' },
          include: contestantIncludes,
          order: [['contestantNumber', 'ASC']]
        })
      : [];
    res.render('contestants', { title: 'Contestants', currentEdition, contestants });
  } catch (err) { next(err); }
});

router.get('/contestants/:slug', async (req, res, next) => {
  try {
    const contestant = await Contestant.findOne({
      where: { slug: req.params.slug },
      include: [{ model: ContestantImage, as: 'images', separate: true, where: { category: 'profile' }, required: false, order: [['sortOrder', 'ASC']] },
        { model: Edition, as: 'edition' }]
    });
    if (!contestant) return res.status(404).render('404', { title: 'Contestant Not Found' });
    res.render('contestant-detail', { title: contestant.fullName, contestant });
  } catch (err) { next(err); }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const currentEdition = await Edition.findOne({ where: { isCurrent: true } });
    const contestants = currentEdition
      ? await Contestant.findAll({
          where: { editionId: currentEdition.id, status: 'approved' },
          include: contestantIncludes,
          order: [['voteCount', 'DESC']]
        })
      : [];
    res.render('leaderboard', { title: 'Live Leaderboard', currentEdition, contestants });
  } catch (err) { next(err); }
});

router.get('/contestants/:slug/blog', async (req, res, next) => {
  try {
    const contestant = await Contestant.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: ContestantImage, as: 'images', separate: true, where: { category: 'outreach' }, required: false, order: [['sortOrder', 'ASC']] },
        { model: Edition, as: 'edition' }
      ]
    });
    if (!contestant) return res.status(404).render('404', { title: 'Page Not Found' });
    res.render('winner-blog', { title: `${contestant.fullName} - Charity Outreach`, contestant });
  } catch (err) { next(err); }
});

module.exports = router;
