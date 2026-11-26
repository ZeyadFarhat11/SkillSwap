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

function requests(_req, res) {
  return res.render('pages/requests', {
    title: 'Swap Requests',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'requests',
    bodyClass: 'bg-[#F4F7FC] text-slate-800 antialiased min-h-screen',
    swapRequests: [
      {
        id: 1,
        partnerName: 'Salma Mohammed',
        wantedSkill: 'Python Programming',
        offeredSkill: 'UI/UX Design',
        direction: 'incoming',
        status: 'pending',
      },
      {
        id: 2,
        partnerName: 'Mohammed Ahmed',
        wantedSkill: 'Cybersecurity',
        offeredSkill: null,
        direction: 'outgoing',
        status: 'pending',
      },
    ],
    swapCandidates: PLACEHOLDER_MATCHES,
  });
}

function sessions(_req, res) {
  return res.render('pages/sessions', {
    title: 'Sessions',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'sessions',
    bodyClass: 'bg-[#F8FAFC] font-sans text-slate-800 antialiased min-h-screen',
    stats: { upcoming: 2, completed: 1, pending: 1 },
    sessionsList: [
      {
        id: 1,
        partnerId: 2,
        partnerName: 'Salma Mohammed',
        skillTitle: 'Python Programming',
        category: 'Programming',
        roleLabel: 'You will learn',
        month: 'NOV',
        day: '28',
        weekday: 'SATURDAY',
        timeRange: '10:00 - 11:00',
        status: 'scheduled',
      },
      {
        id: 2,
        partnerId: 3,
        partnerName: 'Mohammed Ahmed',
        skillTitle: 'UI/UX Design',
        category: 'Design',
        roleLabel: 'You taught',
        month: 'NOV',
        day: '25',
        weekday: 'WEDNESDAY',
        timeRange: '16:00 - 17:00',
        status: 'completed',
      },
    ],
    schedulerSlots: [
      { label: '10:00', selected: false },
      { label: '16:00', selected: true },
      { label: '17:30', selected: false },
    ],
  });
}

function reviewForm(req, res) {
  return res.render('pages/reviewForm', {
    title: 'Leave a Review',
    hideSidebar: true,
    hideFooter: true,
    bodyClass: 'bg-[#F4F7FC] min-h-screen text-slate-800 antialiased flex flex-col justify-between',
    sessionInfo: {
      id: req.validated.params.id,
      partnerName: 'Salma Mohammed',
      skillName: 'Python Programming',
    },
  });
}

function messages(_req, res) {
  return res.render('pages/messages', {
    title: 'Messages',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'messages',
    bodyClass: 'bg-[#F3F6FA] text-slate-800 min-h-screen antialiased',
    conversations: [
      {
        userId: 2,
        name: 'Salma Mohammed',
        lastMessage: 'Sure, see you Saturday at 10:00!',
        timeAgo: '1h ago',
        online: true,
      },
      {
        userId: 3,
        name: 'Mohammed Ahmed',
        lastMessage: "Great! Let's confirm the session time.",
        timeAgo: '2h ago',
        online: false,
      },
    ],
  });
}

function chat(req, res) {
  const peerId = req.validated.params.userId;
  return res.render('pages/chat', {
    title: 'Chat',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'messages',
    bodyClass: 'bg-[#f4f7fb] text-slate-800 font-sans antialiased min-h-screen',
    peer: { id: peerId, name: 'Salma Mohammed' },
    chatMessages: [
      { isOwn: false, content: 'Hi! Can we schedule our Python session?' },
      { isOwn: true, content: 'Sure! Does Saturday at 10:00 work for you?' },
      { isOwn: false, content: 'Deal! Looking forward to it.' },
    ],
  });
}

function points(_req, res) {
  return res.render('pages/points', {
    title: 'Points Wallet',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'points',
    bodyClass: 'min-h-screen bg-[#f4f7fb] text-slate-800 antialiased',
    starterPoints: STARTER_POINTS,
    wallet: {
      balance: STARTER_POINTS,
      totalEarned: STARTER_POINTS,
      totalSpent: 0,
      thisMonth: STARTER_POINTS,
    },
    transactions: [
      {
        label: 'Welcome starter bonus',
        type: 'bonus',
        dateLabel: 'Nov 26, 2026',
        amount: STARTER_POINTS,
        isCredit: true,
      },
    ],
  });
}

function reports(_req, res) {
  return res.render('pages/reports', {
    title: 'Reports',
    useSidebar: true,
    hideFooter: true,
    activeNav: 'reports',
    bodyClass: 'bg-[#F0F4F8] font-sans antialiased text-slate-800 min-h-screen',
    reportTypes: [
      { value: 'user', label: 'User behavior or no-show' },
      { value: 'message', label: 'Inappropriate message' },
      { value: 'bug', label: 'Bug or technical issue' },
      { value: 'other', label: 'Other' },
    ],
  });
}

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
  requests,
  sessions,
  reviewForm,
  messages,
  chat,
  points,
  reports,
  adminUsers,
  adminSkills,
  adminReports,
};
