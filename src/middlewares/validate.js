const AppError = require('../utils/AppError');

const SENSITIVE_FIELDS = new Set(['password', 'confirmPassword', 'currentPassword', '_csrf']);

/**
 * Extract safe form values to repopulate inputs after validation errors.
 */
function extractSafeFormData(body) {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const safe = {};
  for (const [key, value] of Object.entries(body)) {
    if (!SENSITIVE_FIELDS.has(key) && typeof value === 'string') {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Convert Zod issues into a flat field -> first error message map.
 */
function mapZodFieldErrors(issues) {
  const fieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_form';
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Validate req[source] with a Zod schema. When `view` is configured, re-renders
 * the form with status 400, field errors, and flash error feedback.
 */
function validate(schema, options = {}) {
  const source = options.source || 'body';

  return (req, res, next) => {
    const result = schema.safeParse(req[source] || {});
    if (result.success) {
      req.validated = req.validated || {};
      req.validated[source] = result.data;
      if (source === 'body') {
        req.validatedBody = result.data;
      }
      return next();
    }

    const fieldErrors = mapZodFieldErrors(result.error.issues);
    const firstMessage = result.error.issues[0]?.message || 'Please check your input.';

    if (options.view) {
      return res.status(400).render(options.view, {
        title: options.title,
        hideNavbar: Boolean(options.hideNavbar),
        hideFooter: Boolean(options.hideFooter),
        bodyClass: options.bodyClass,
        errors: fieldErrors,
        formData: extractSafeFormData(req.body),
        flash: {
          error: [firstMessage],
          success: [],
          info: [],
        },
      });
    }

    return next(new AppError(firstMessage, 400, fieldErrors));
  };
}

module.exports = {
  validate,
  extractSafeFormData,
};
