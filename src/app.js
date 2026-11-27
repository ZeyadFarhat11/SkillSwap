const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');

const env = require('./config/env');
const { createSessionMiddleware } = require('./config/session');
const { csrfProtection, attachCsrfToken } = require('./middlewares/csrf');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const skillRoutes = require('./routes/skillRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const requestRoutes = require('./routes/requestRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const pointsRoutes = require('./routes/pointsRoutes');
const pageRoutes = require('./routes/pageRoutes');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));
app.use(express.static(path.join(__dirname, '..', 'public')));

const sessionMiddleware = createSessionMiddleware();
app.sessionMiddleware = sessionMiddleware;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser(env.SESSION_SECRET));
app.use(sessionMiddleware);
app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.user || null;
  res.locals.csrfToken = null;
  res.locals.flash = {
    error: req.flash('error'),
    success: req.flash('success'),
    info: req.flash('info'),
  };
  next();
});

app.use(csrfProtection);
app.use(attachCsrfToken);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(pageRoutes);
app.use(authRoutes);
app.use(profileRoutes);
app.use(skillRoutes);
app.use(availabilityRoutes);
app.use(requestRoutes);
app.use(sessionRoutes);
app.use(ratingRoutes);
app.use(messageRoutes);
app.use(reportRoutes);
app.use(pointsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
