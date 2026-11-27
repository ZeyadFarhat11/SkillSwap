require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../src/models/prisma');
const {
  BCRYPT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  POINTS_TYPES,
  SKILL_STATUSES,
  STARTER_POINTS,
  USER_ROLES,
  USER_STATUSES,
} = require('../src/config/constants');

const INITIAL_SKILLS = [
  'Python Programming',
  'Data Structures',
  'Web Development',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'SQL & Databases',
  'UI/UX Design',
  'Figma Design',
  'Adobe Photoshop',
  'Cybersecurity',
  'Machine Learning',
  'Content Writing',
  'Excel',
  'Public Speaking',
  'Video Editing',
  'French',
  'Spanish',
  'Guitar',
];

async function seedSkills() {
  for (const skillName of INITIAL_SKILLS) {
    await prisma.skill.upsert({
      where: { skillName },
      update: {},
      create: {
        skillName,
        status: SKILL_STATUSES.APPROVED,
      },
    });
  }
}

async function seedAdminUser() {
  const adminEmail = 'admin@skillswap.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    return existing;
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be set in .env and be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const admin = await tx.user.create({
      data: {
        name: 'SkillSwap Admin',
        email: adminEmail,
        passwordHash,
        role: USER_ROLES.ADMIN,
        status: USER_STATUSES.ACTIVE,
        pointsBalance: STARTER_POINTS,
        bio: 'Platform administrator',
      },
    });

    if (STARTER_POINTS > 0) {
      await tx.pointsTransaction.create({
        data: {
          userId: admin.id,
          type: POINTS_TYPES.BONUS,
          amount: STARTER_POINTS,
        },
      });
    }

    return admin;
  });
}

async function main() {
  await seedSkills();
  await seedAdminUser();
  console.log(`Seeded ${INITIAL_SKILLS.length} approved skills and default admin user.`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  INITIAL_SKILLS,
  seedSkills,
  seedAdminUser,
};
