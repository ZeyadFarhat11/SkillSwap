/**
 * Operational application error carrying an HTTP status code and optional field errors.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, fieldErrors = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

module.exports = AppError;
