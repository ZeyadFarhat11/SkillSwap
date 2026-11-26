const env = require('../config/env');

const STATUS_TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Page Not Found',
  429: 'Too Many Requests',
};

function notFoundHandler(req, res) {
  res.status(404).render('pages/error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you requested could not be found.',
  });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (env.NODE_ENV !== 'test' && !isClientError) {
    console.error(err);
  }

  const friendlyMessage = isClientError
    ? err.message
    : 'An unexpected error occurred. Please try again later.';

  res.status(statusCode).render('pages/error', {
    title: STATUS_TITLES[statusCode] || 'Error',
    statusCode,
    message: friendlyMessage,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
