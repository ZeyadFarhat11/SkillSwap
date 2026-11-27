const env = require('../config/env');

const STATUS_TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Page Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Server Error',
  503: 'Service Unavailable',
};

function notFoundHandler(req, res) {
  res.status(404).render('pages/error', {
    title: 'Page Not Found',
    statusCode: 404,
    hideSidebar: !req.session?.user,
    message: 'The page you requested could not be found.',
  });
}

function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let customMessage = null;

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    customMessage = 'Invalid request payload format.';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    customMessage = 'Uploaded file exceeds the maximum allowed size.';
  }

  const isClientError = statusCode >= 400 && statusCode < 500;

  if (env.NODE_ENV !== 'test' && !isClientError) {
    console.error(err);
  }

  const friendlyMessage = isClientError
    ? customMessage || err.message
    : 'An unexpected error occurred. Please try again later.';

  res.status(statusCode).render('pages/error', {
    title: STATUS_TITLES[statusCode] || 'Error',
    statusCode,
    hideSidebar: !req.session?.user,
    message: friendlyMessage,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
