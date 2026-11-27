const { STARTER_POINTS } = require('../config/constants');

const PLACEHOLDER_MATCHES = [
  {
    id: 2,
    name: 'Salma Mohammed',
    roleTitle: 'Programmer',
    rating: '4.9',
    score: 92,
    teaches: ['Python Programming', 'Data Structures', 'Web Development'],
    learns: ['UI/UX Design', 'React', 'Node.js'],
    ctaHref: '/requests',
    ctaLabel: 'Schedule Swap',
  },
  {
    id: 3,
    name: 'Mohammed Ahmed',
    roleTitle: 'IT Engineer',
    rating: '4.6',
    score: 84,
    teaches: ['Cybersecurity', 'SQL & Databases', 'French'],
    learns: ['Guitar', 'Video Editing', 'Spanish'],
    ctaHref: '/requests',
    ctaLabel: 'Schedule Swap',
  },
  {
    id: 4,
    name: 'Samy Ali',
    roleTitle: 'Designer',
    rating: '4.4',
    score: 78,
    teaches: ['Figma Design', 'Adobe Photoshop', 'React'],
    learns: ['Content Writing', 'Excel', 'Public Speaking'],
    ctaHref: '/requests',
    ctaLabel: 'Schedule Swap',
  },
];

function home(req, res) {
  if (req.session?.user) {
    return res.redirect('/suggestions');
  }
  return res.render('pages/welcome', {
    title: 'Welcome',
    hideSidebar: true,
    hideFooter: true,
    bodyClass: 'min-h-screen w-full flex flex-col justify-center items-center px-4 font-sans select-none bg-[#f6f8fd]',
  });
}

function welcomePoints(_req, res) {
  return res.render('pages/welcomePoints', {
    title: 'You Earned Points!',
    hideSidebar: true,
    hideFooter: true,
    bodyClass: 'min-h-screen bg-[#eef2fc] flex items-center justify-center p-4 antialiased font-sans',
    starterPoints: STARTER_POINTS,
  });
}

function suggestions(_req, res) {
  return res.render('pages/suggestions', {
    title: 'Suggestions',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'suggestions',
    bodyClass: 'bg-[#F4F7FC] text-slate-800 antialiased min-h-screen',
    matches: PLACEHOLDER_MATCHES,
  });
}

// requests(), sessions(), and reviewForm() moved to requestController.js and sessionController.js (Phase 5)

// messages(), chat(), points(), and reports() moved to dedicated controllers in Phase 6:
// messageController.js, pointsController.js, reportController.js

function adminUsers(_req, res) {
  return res.render('pages/adminUsers', {
    title: 'User Management',
    useSidebar: true,
    isAdminLayout: true,
    hideFooter: true,
    activeNav: 'admin-users',
    bodyClass: 'bg-[#f8fafc] min-h-screen antialiased text-slate-700',
    summary: { totalUsers: 3, activeUsers: 2, suspendedUsers: 1 },
    users: [
      { id: 2, name: 'Salma Mohammed', email: 'salma@example.com', status: 'active', pointsBalance: 30 },
      { id: 3, name: 'Mohammed Ahmed', email: 'mohammed@example.com', status: 'active', pointsBalance: 20 },
      { id: 4, name: 'Test Suspended', email: 'susp@example.com', status: 'suspended', pointsBalance: 10 },
    ],
  });
}

function adminSkills(_req, res) {
  return res.render('pages/adminSkills', {
    title: 'Skill Management',
    useSidebar: true,
    isAdminLayout: true,
    hideFooter: true,
    activeNav: 'admin-skills',
    bodyClass: 'min-h-screen text-[#141A29] antialiased bg-[#F8FAFC]',
    summary: { total: 21, pending: 1, approved: 20 },
    skills: [
      { id: 1, skillName: 'Python Programming', status: 'approved' },
      { id: 21, skillName: 'Rust Programming', status: 'pending' },
    ],
  });
}

function adminReports(_req, res) {
  return res.render('pages/adminReports', {
    title: 'Reports Management',
    useSidebar: true,
    isAdminLayout: true,
    hideFooter: true,
    activeNav: 'admin-reports',
    bodyClass: 'min-h-screen text-[#141A29] antialiased bg-[#F8FAFC]',
    summary: { open: 1, inReview: 1, resolved: 0 },
    reports: [
      {
        id: 1,
        subject: 'Missed scheduled session',
        description: 'Peer did not join at the scheduled slot.',
        type: 'user',
        submitterName: 'Salma Mohammed',
        status: 'open',
      },
      {
        id: 2,
        subject: 'Profile avatar upload issue',
        description: 'Form error message wording feedback.',
        type: 'bug',
        submitterName: 'Mohammed Ahmed',
        status: 'in_review',
      },
    ],
  });
}

module.exports = {
  home,
  welcomePoints,
  suggestions,
  adminUsers,
  adminSkills,
  adminReports,
};
