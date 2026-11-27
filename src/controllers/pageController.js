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

module.exports = {
  home,
  welcomePoints,
  suggestions,
};
