require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const { Server } = require('socket.io');

const { sequelize } = require('./models');
const { initSocket } = require('./sockets');
const { loadUser } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// This MUST be the first thing mounted on the app - before view engine
// setup, sessions, or (critically) express.json()/express.urlencoded()
// below. Paystack webhook signature verification needs the raw,
// byte-for-byte request body; once express.json() parses it into an
// object, that's gone. Keeping this at the very top (not just "before the
// body parsers" further down) means it can never accidentally end up
// after them, however this file gets edited later.
app.use('/webhooks', require('./routes/webhookRoutes'));

// Trust the first proxy hop (ngrok, or a reverse proxy in production) so
// req.protocol reflects X-Forwarded-Proto correctly - needed for getBaseUrl()
// to detect https correctly when tunneled, and for secure cookies later.
app.set('trust proxy', 1);

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);
initSocket(io);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Body parsing & static assets
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Sessions (Postgres-backed so they survive restarts)
const sessionStore = new SequelizeStore({ db: sequelize });
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

app.use(flash());

// Attach logged-in user + wallet to every request/view
app.use(loadUser);
app.use((req, res, next) => {
  res.locals.currentUser = req.currentUser || null;
  res.locals.currentPath = req.path;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/', require('./routes/publicRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/vote', require('./routes/voteRoutes'));
app.use('/wallet', require('./routes/walletRoutes'));
app.use('/tickets', require('./routes/ticketRoutes'));
app.use('/apply', require('./routes/applicationRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/staff', require('./routes/staffRoutes'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Central error handler - logs the FULL error (Sequelize errors especially
// hide the real cause in err.original/err.parent) and shows something
// readable instead of a bare stack trace.
app.use((err, req, res, next) => {
  console.error('--- Unhandled error ---');
  console.error(err);
  if (err.original) console.error('Original DB error:', err.original.message);
  if (err.parent) console.error('Parent DB error:', err.parent.message);
  if (err.response?.data) console.error('External API error response:', JSON.stringify(err.response.data));

  res.status(err.status || 500);
  if (req.accepts('html')) {
    res.render('error', {
      title: 'Something Went Wrong',
      message: err.message || 'Unexpected error',
      detail: process.env.NODE_ENV !== 'production'
        ? (err.original?.message || err.parent?.message || (err.response?.data ? JSON.stringify(err.response.data) : null) || err.stack)
        : null
    });
  } else {
    res.json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Creates every table (and any missing columns) from the models if they
    // don't already exist. Safe to run on every boot - alter only adds what's
    // missing, it won't drop existing data. The migrations/ folder is still
    // there if you'd rather run controlled migrations in production instead.
    await sequelize.sync({ alter: true });
    console.log('Database tables ready.');

    await sessionStore.sync();

    server.listen(PORT, () => {
      console.log(`The Carnival Queen running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('!!! Failed to start - could not connect to or sync the database.');
    console.error(err.original?.message || err.parent?.message || err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
