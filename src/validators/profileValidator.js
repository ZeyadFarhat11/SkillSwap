const { z } = require('zod');

const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid user ID.'),
});

function normalizeProjectLinksInput(raw) {
  if (raw === undefined || raw === null) {
    return [];
  }
  const items = Array.isArray(raw) ? raw : String(raw).split(/[\r\n]+/);
  return items.map((s) => String(s).trim()).filter(Boolean);
}

const projectUrlSchema = z
  .string()
  .url('Each project link must be a valid URL (including https:// or http://).')
  .max(500, 'Project link must be 500 characters or fewer.')
  .refine((val) => val.startsWith('https://') || val.startsWith('http://'), {
    message: 'Project links must start with http:// or https://.',
  });

const profileEditSchema = z.object({
  name: z
    .string({ required_error: 'Please enter your name.' })
    .trim()
    .min(1, 'Please enter your name.')
    .max(150, 'Name must be 150 characters or fewer.'),
  bio: z
    .string()
    .trim()
    .max(1000, 'Bio must be 1000 characters or fewer.')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  projectLinks: z.preprocess(
    normalizeProjectLinksInput,
    z
      .array(projectUrlSchema)
      .max(10, 'You can add up to 10 project links.')
      .transform((links) => Array.from(new Set(links)))
  ),
});

module.exports = {
  userIdParamSchema,
  profileEditSchema,
};
