const WIDTH = 1080;
const HEIGHT = 1920;
const DURATION = 35;
const canvas = document.querySelector('#reel-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const overlay = document.querySelector('#play-overlay');
const playButton = document.querySelector('#play-button');
const restartButton = document.querySelector('#restart-button');
const recordButton = document.querySelector('#record-button');
const exportStatus = document.querySelector('#export-status');
const progressFill = document.querySelector('#progress-fill');
const progressBar = document.querySelector('.track');
const timecode = document.querySelector('#timecode');
const brandMark = new Image();
brandMark.src = '/logo-mark-white.svg';

const ease = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothPop = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

function roundRect(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function label(content, x, y, size, color, weight = 500, align = 'left') {
  ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(content, x, y);
}

function wrappedLabel(content, x, y, maxWidth, size, lineHeight, color, weight = 500) {
  ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  let top = y;
  for (const paragraph of content.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        ctx.fillText(line, x, top);
        top += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      ctx.fillText(line, x, top);
      top += lineHeight;
    }
  }
}

function sceneBackground(time, tint = 0) {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, '#101d43');
  base.addColorStop(0.56, '#101a39');
  base.addColorStop(1, tint ? '#152d61' : '#0a1633');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(
    WIDTH * (0.74 + Math.sin(time * 0.19) * 0.07), HEIGHT * (0.28 + Math.cos(time * 0.13) * 0.04), 0,
    WIDTH * 0.6, HEIGHT * 0.38, WIDTH * 0.78
  );
  glow.addColorStop(0, `rgba(48, 108, 241, ${tint ? 0.27 : 0.19})`);
  glow.addColorStop(1, 'rgba(20, 43, 91, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(177, 201, 255, 0.035)';
  ctx.lineWidth = 1;
  const offset = (time * 11) % 112;
  for (let y = -112 + offset; y < HEIGHT + 112; y += 112) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function lightPill(content, x, y, width = 205) {
  roundRect(x, y, width, 39, 20, 'rgba(117, 154, 228, .13)', 'rgba(203, 218, 255, .18)');
  label(content, x + width / 2, y + 20, 12, '#c5d6ff', 750, 'center');
}

function glassCard(x, y, width, height, radius = 24) {
  roundRect(x, y, width, height, radius, 'rgba(255,255,255,0.97)', 'rgba(255,255,255,0.57)', 2);
}

function drawSpreadsheet(x, y, width, height, progress, angle = 0) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(angle);
  const left = -width / 2;
  const top = -height / 2;
  roundRect(left, top, width, height, 17, '#f8faff', 'rgba(207,219,238,.85)');
  roundRect(left, top, width, 50, 17, '#e8edf7');
  ctx.fillStyle = '#e8edf7';
  ctx.fillRect(left, top + 32, width, 20);
  ctx.fillStyle = '#c2cddd';
  for (let i = 0; i < 3; i++) ctx.beginPath(), ctx.arc(left + 20 + i * 18, top + 25, 5, 0, Math.PI * 2), ctx.fill();
  label('Employee attendance.xlsx', left + 75, top + 25, 12, '#52617b', 600);
  label('Employee', left + 20, top + 77, 10, '#79869e', 700);
  label('Status', left + width * 0.62, top + 77, 10, '#79869e', 700);
  ctx.strokeStyle = '#e8edf5';
  for (let i = 0; i < 6; i++) {
    const rowY = top + 99 + i * 41;
    ctx.beginPath();
    ctx.moveTo(left + 16, rowY + 14);
    ctx.lineTo(left + width - 16, rowY + 14);
    ctx.stroke();
    roundRect(left + 20, rowY - 3, width * 0.31, 7, 4, i % 2 ? '#d6deed' : '#c6d1e3');
    roundRect(left + width * 0.62, rowY - 3, width * 0.2, 7, 4, i === 2 && progress > 0.5 ? '#b5c9fb' : '#d6deed');
  }
  ctx.restore();
}

function drawRequestStack(time, progress) {
  const cards = [
    { title: 'Leave request', detail: 'Waiting for review', icon: 'L', color: '#e8efff', delay: 0.06 },
    { title: 'Attendance report', detail: 'Open spreadsheet', icon: 'A', color: '#e6f5f3', delay: 0.21 },
    { title: 'Employee record', detail: 'Document to check', icon: 'D', color: '#f0ebfc', delay: 0.34 },
  ];
  cards.forEach((card, i) => {
    const entrance = smoothPop((progress - card.delay) * 2.5);
    const bob = Math.sin(time * 1.45 + i * 1.7) * 7;
    const x = 564 - entrance * 54 + i * 22;
    const y = 1108 + i * 129 + bob + (1 - entrance) * 52;
    ctx.save();
    ctx.globalAlpha = 0.64 + entrance * 0.36;
    roundRect(x, y, 399, 91, 20, '#f7f9ff', 'rgba(255,255,255,.38)', 1);
    roundRect(x + 18, y + 18, 54, 54, 15, card.color);
    label(card.icon, x + 45, y + 45, 17, '#345bb1', 750, 'center');
    label(card.title, x + 91, y + 35, 14, '#15264a', 720);
    label(card.detail, x + 91, y + 61, 11, '#7785a0', 500);
    roundRect(x + 332, y + 30, 6, 6, 4, '#f0ad56');
    roundRect(x + 343, y + 30, 6, 6, 4, '#f0ad56');
    roundRect(x + 354, y + 30, 6, 6, 4, '#f0ad56');
    ctx.restore();
  });
}

function drawManager(time) {
  const pulse = Math.sin(time * 1.4) * 4;
  ctx.save();
  const desk = ctx.createLinearGradient(80, 0, 995, 0);
  desk.addColorStop(0, '#172958');
  desk.addColorStop(1, '#253967');
  roundRect(59, 1484 + pulse, 957, 20, 10, desk);
  roundRect(113, 1501 + pulse, 18, 246, 7, '#18254b');
  roundRect(952, 1501 + pulse, 18, 246, 7, '#18254b');

  ctx.fillStyle = '#080f21';
  ctx.beginPath();
  ctx.ellipse(526, 1491 + pulse, 335, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(238, 1784);
  ctx.bezierCurveTo(264, 1591, 353, 1540, 490, 1539);
  ctx.bezierCurveTo(624, 1541, 713, 1596, 747, 1784);
  ctx.closePath();
  const shirt = ctx.createLinearGradient(230, 1538, 720, 1790);
  shirt.addColorStop(0, '#526ab0');
  shirt.addColorStop(1, '#294987');
  ctx.fillStyle = shirt;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(416, 1549);
  ctx.lineTo(491, 1650);
  ctx.lineTo(571, 1549);
  ctx.lineTo(542, 1529);
  ctx.lineTo(464, 1529);
  ctx.closePath();
  ctx.fillStyle = '#f5f7ff';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(493, 1482, 100, 116, 0, 0, Math.PI * 2);
  const skin = ctx.createLinearGradient(400, 1380, 590, 1540);
  skin.addColorStop(0, '#d89b78');
  skin.addColorStop(1, '#b87961');
  ctx.fillStyle = skin;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(394, 1466);
  ctx.bezierCurveTo(373, 1380, 418, 1340, 476, 1344);
  ctx.bezierCurveTo(549, 1322, 598, 1373, 583, 1454);
  ctx.lineTo(570, 1465);
  ctx.bezierCurveTo(545, 1414, 501, 1405, 470, 1408);
  ctx.bezierCurveTo(445, 1438, 425, 1442, 394, 1466);
  ctx.closePath();
  ctx.fillStyle = '#1a2035';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(474, 1478);
  ctx.lineTo(481, 1479);
  ctx.moveTo(522, 1479);
  ctx.lineTo(529, 1478);
  ctx.stroke();
  ctx.restore();
}

function drawSceneOne(time, progress) {
  sceneBackground(time);
  const reveal = smoothPop(progress * 4.4);
  lightPill('PEOPLE OPERATIONS, UNTANGLED', 72, 164, 309);
  label('HR deserves', 72, 286, 64, '#9cbcff', 620);
  label('to be smarter.', 72, 367, 69, '#f6f8ff', 730);
  label('Still managing HR the hard way?', 76, 437, 18, '#bac6de', 480);
  drawSpreadsheet(88 + Math.sin(time * 1.05) * 6, 647, 514, 401, progress, -0.025);
  drawRequestStack(time, progress);
  drawManager(time);

  const glow = ctx.createRadialGradient(495, 1398, 0, 495, 1398, 365);
  glow.addColorStop(0, `rgba(95, 145, 255, ${0.1 * reveal})`);
  glow.addColorStop(1, 'rgba(95,145,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(70, 1018, 855, 579);
  label('A PEOPLE-FIRST HR PLATFORM', 540, 1833, 11, '#aabce0', 750, 'center');
}

function drawWorkflowList(x, y, progress) {
  const workflows = [
    ['P', 'Employee directory'],
    ['T', 'Attendance records'],
    ['L', 'Leave requests'],
  ];
  workflows.forEach(([icon, name], index) => {
    const rowY = y + index * 51;
    ctx.save();
    ctx.globalAlpha = 0.4 + ease(progress) * 0.6;
    roundRect(x, rowY, 371, 43, 11, index === 1 ? '#f6f8fc' : '#fbfcfe');
    roundRect(x + 9, rowY + 7, 28, 28, 9, ['#e7eeff', '#e7f4ef', '#f0ebfb'][index]);
    label(icon, x + 23, rowY + 21, 10, '#4261a0', 730, 'center');
    label(name, x + 48, rowY + 22, 11, '#34425e', 600);
    roundRect(x + 328, rowY + 17, 25, 7, 4, '#dce5f3');
    ctx.restore();
  });
}

function drawDashboard(time, progress) {
  sceneBackground(time, 1);
  lightPill('MEET YOUR PEOPLE PLATFORM', 72, 142, 298);
  label('Meet Vettri HRMS', 72, 255, 61, '#fff', 720);
  label('Employee management, connected.', 75, 307, 18, '#bac9e7', 500);

  const entrance = smoothPop(progress * 1.45);
  ctx.save();
  ctx.globalAlpha = 0.18 + entrance * 0.82;
  ctx.translate(540, 1075);
  ctx.scale(0.9 + 0.1 * entrance, 0.9 + 0.1 * entrance);
  ctx.translate(-540, -1075);

  glassCard(72, 457, 936, 908, 29);
  roundRect(72, 457, 196, 908, 29, '#101d3a');
  ctx.fillStyle = '#101d3a';
  ctx.fillRect(240, 457, 28, 908);
  roundRect(98, 488, 145, 46, 14, 'rgba(255,255,255,.08)');
  roundRect(111, 501, 21, 21, 7, '#4e82ec');
  label('Vettri HRMS', 145, 513, 14, '#f3f6ff', 700);

  const navItems = ['Overview', 'Employees', 'Attendance', 'Leave', 'Payroll', 'Documents'];
  navItems.forEach((item, index) => {
    const itemY = 589 + index * 61;
    if (index === 0) roundRect(96, itemY - 19, 151, 43, 12, 'rgba(63,108,209,.26)');
    roundRect(110, itemY - 7, 14, 14, 4, index === 0 ? '#82a8ff' : 'rgba(209,220,245,.44)');
    label(item, 137, itemY, 12, index === 0 ? '#fff' : '#aab5ce', index === 0 ? 700 : 500);
  });

  roundRect(301, 489, 676, 53, 15, '#f4f7fc');
  roundRect(321, 505, 25, 22, 8, '#fff');
  label('Good morning.', 363, 516, 14, '#17264a', 700);
  roundRect(851, 500, 36, 34, 17, '#d6e3ff');
  label('V', 869, 518, 12, '#3659a8', 750, 'center');
  label('Your people, in one place', 304, 591, 23, '#1e2d4c', 720);
  label('Employee management', 305, 623, 12, '#7b89a1', 500);

  const infoCards = [
    { title: 'People', content: 'Employee directory', tone: '#eef3ff' },
    { title: 'Time', content: 'Attendance records', tone: '#eaf6f4' },
    { title: 'Leave', content: 'Requests & balance', tone: '#f1edfb' },
  ];
  infoCards.forEach((card, index) => {
    const x = 301 + index * 219;
    roundRect(x, 671, 202, 144, 18, '#fff', '#e8ecf3');
    roundRect(x + 17, 690, 35, 35, 12, card.tone);
    roundRect(x + 66, 692, 87 + index * 9, 8, 4, '#d4dbea');
    roundRect(x + 66, 710, 100, 6, 3, '#edf0f6');
    label(card.title, x + 20, 765, 14, '#213251', 720);
    label(card.content, x + 20, 790, 10, '#8793a8', 500);
  });

  roundRect(301, 842, 420, 299, 18, '#fff', '#e8ecf3');
  label('Everyday HR, together', 324, 877, 16, '#213251', 700);
  label('The workflows your team knows', 324, 906, 10, '#8994a7', 500);
  drawWorkflowList(324, 941, progress);

  roundRect(743, 842, 234, 299, 18, '#fff', '#e8ecf3');
  label('Your workspace', 766, 877, 14, '#213251', 700);
  label('Move between HR workflows', 766, 905, 10, '#8994a7', 500);
  ['Employees', 'Payroll', 'Documents', 'Performance'].forEach((area, index) => {
    const rowY = 947 + index * 45;
    roundRect(766, rowY, 188, 35, 11, '#fafbfd');
    roundRect(777, rowY + 8, 19, 19, 7, ['#e9efff', '#fff0dc', '#edf4ff', '#eff0fc'][index]);
    label(['P', '₹', 'D', 'G'][index], 786, rowY + 18, 9, '#45609b', 720, 'center');
    label(area, 808, rowY + 18, 10, '#465572', 600);
    roundRect(928, rowY + 15, 12, 5, 3, '#dce5f3');
  });

  roundRect(301, 1163, 676, 158, 18, '#edf3ff');
  roundRect(322, 1183, 41, 41, 14, '#dbe7ff');
  label('✓', 343, 1204, 17, '#2e61ce', 750, 'center');
  label('One connected workspace', 381, 1200, 14, '#213251', 700);
  label('People, time and employee workflows together.', 381, 1230, 11, '#6c7b95', 500);
  roundRect(828, 1197, 123, 33, 10, '#fff');
  label('View details', 890, 1214, 10, '#315db9', 700, 'center');
  ctx.restore();

  label('BUILT FOR GROWING TEAMS', 540, 1498, 11, '#afc3ee', 750, 'center');
}

function drawSpark(x, y, radius, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#a7c4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x, y + radius);
  ctx.moveTo(x - radius, y);
  ctx.lineTo(x + radius, y);
  ctx.stroke();
  ctx.restore();
}

function drawChatMessage(x, y, width, height, isUser, content, time, progress) {
  const pop = smoothPop(progress * 2.7);
  ctx.save();
  ctx.globalAlpha = pop;
  ctx.translate((isUser ? 1 : -1) * (1 - pop) * 26, 0);
  roundRect(
    x, y, width, height, 19,
    isUser ? '#2563eb' : '#f4f7fc',
    isUser ? 'rgba(255,255,255,.12)' : 'rgba(206,219,246,.6)', 1
  );
  wrappedLabel(content, x + 23, y + 31, width - 45, 14, 22, isUser ? '#fff' : '#273451', isUser ? 550 : 600);
  label(time, x + width - 17, y + height - 16, 9, isUser ? '#ccdcff' : '#8490a5', 550, 'right');
  ctx.restore();
}

function drawAssistantScene(time, progress) {
  sceneBackground(time, 1);
  lightPill('INTRODUCING ASK VETTRI', 72, 122, 244);
  label('Meet Ask Vettri', 72, 233, 56, '#fff', 730);
  label('Your AI-powered HR assistant.', 75, 281, 16, '#b7c7e6', 500);

  const windowY = 390;
  glassCard(72, windowY, 936, 1010, 30);
  roundRect(72, windowY, 936, 96, 30, '#f3f6fc');
  ctx.fillStyle = '#f3f6fc';
  ctx.fillRect(72, windowY + 61, 936, 35);
  roundRect(99, windowY + 23, 48, 48, 16, '#e4ecff');
  drawSpark(123, windowY + 47, 9);
  label('Ask Vettri', 164, windowY + 40, 15, '#1d2d4e', 730);
  label('Your HR assistant', 164, windowY + 65, 10, '#8592a8', 500);
  roundRect(920, windowY + 35, 8, 8, 5, '#47b58d');
  label('HERE TO HELP', 905, windowY + 64, 8, '#70839e', 720, 'right');

  label('TODAY', 540, 529, 9, '#8b97aa', 720, 'center');
  const typed = progress > 0.26;
  drawChatMessage(419, 568, 528, 89, true, 'How many casual leave days do I have?', time, typed ? (progress - 0.25) / 0.14 : 0);
  drawChatMessage(167, 678, 666, 129, false, 'I can help you check your leave balance. Let’s open your leave details.', time, progress > 0.4 ? (progress - 0.4) / 0.16 : 0);

  const actionReveal = ease((progress - 0.5) / 0.15);
  ctx.save();
  ctx.globalAlpha = actionReveal;
  roundRect(193, 822, 438, 60, 15, '#edf3ff', '#dce7fb');
  roundRect(211, 837, 32, 30, 10, '#dbe7ff');
  label('↗', 227, 853, 15, '#3164d0', 700, 'center');
  label('View your leave details', 259, 853, 13, '#3155a7', 700);
  roundRect(560, 844, 48, 14, 7, '#cad8f6');
  ctx.restore();

  const secondPrompt = progress > 0.6;
  drawChatMessage(415, 942, 532, 90, true, 'I want to apply for leave next Monday.', time, secondPrompt ? (progress - 0.59) / 0.12 : 0);
  drawChatMessage(167, 1054, 666, 135, false, 'Let’s prepare your request. You can review everything before continuing.', time, progress > 0.76 ? (progress - 0.76) / 0.14 : 0);

  const formProgress = ease((progress - 0.79) / 0.14);
  ctx.save();
  ctx.globalAlpha = formProgress;
  roundRect(190, 1207, 704, 142, 19, '#f7f9fd', '#e4eaf4');
  label('LEAVE REQUEST · REVIEW FIRST', 215, 1234, 10, '#526891', 750);
  roundRect(215, 1261, 296, 58, 12, '#fff', '#e1e8f2');
  label('Requested date', 231, 1278, 9, '#8591a5', 600);
  label('Next Monday', 231, 1301, 12, '#2a3854', 680);
  roundRect(528, 1261, 170, 58, 12, '#fff', '#e1e8f2');
  label('Leave type', 545, 1278, 9, '#8591a5', 600);
  label('Your selected type', 545, 1301, 11, '#526891', 600);
  roundRect(711, 1274, 163, 34, 10, '#2563eb');
  label('Review request  ›', 792, 1292, 10, '#fff', 700, 'center');
  ctx.restore();

  const confirmationProgress = ease((progress - 0.87) / 0.09);
  ctx.save();
  ctx.globalAlpha = confirmationProgress;
  roundRect(190, 1366, 704, 124, 20, '#fff', 'rgba(215,228,250,.74)');
  label('Confirm leave request?', 216, 1394, 15, '#263654', 720);
  label('Next Monday · your selected leave type', 216, 1421, 10, '#8190a8', 500);
  roundRect(500, 1439, 120, 34, 10, '#f0f3f8', '#e2e7ef');
  label('Edit', 560, 1457, 10, '#5c6c85', 650, 'center');
  roundRect(633, 1439, 241, 34, 10, '#2563eb');
  label('Submit Leave', 753, 1457, 10, '#fff', 700, 'center');
  ctx.restore();

  label('YOUR REQUEST IS SENT ONLY AFTER YOU CONFIRM.', 540, 1541, 10, '#bfd0f4', 730, 'center');
}

const promiseLines = [
  { text: 'Simplify HR', sub: 'Less admin. More focus.', glyph: '↗' },
  { text: 'Empower Employees', sub: 'People find what they need.', glyph: '◉' },
  { text: 'Streamline Workflows', sub: 'Everyday work, in one place.', glyph: '▤' },
  { text: 'Work Smarter with AI', sub: 'Meet your HR assistant.', glyph: '✦' },
];

const moduleTiles = [
  { title: 'Employees', sub: 'People & profiles', glyph: 'P' },
  { title: 'Attendance', sub: 'Time & presence', glyph: 'T' },
  { title: 'Leave', sub: 'Requests & balance', glyph: 'L' },
  { title: 'Payroll', sub: 'Salary & payroll', glyph: '₹' },
  { title: 'Documents', sub: 'Employee documents', glyph: 'D' },
  { title: 'Performance', sub: 'Goals & reviews', glyph: 'G' },
];

function drawProductFeatures(time, progress) {
  sceneBackground(time, 1);
  lightPill('ONE CONNECTED PLATFORM', 72, 119, 251);
  label('More time for', 72, 230, 57, '#fff', 700);
  label('the work that matters.', 72, 294, 52, '#aac4ff', 700);

  const oneLineDuration = 0.21;
  const activePromise = Math.min(3, Math.floor(progress / oneLineDuration));
  const line = promiseLines[activePromise];
  const segmentStart = activePromise * oneLineDuration;
  const segmentLength = activePromise === 3 ? 1 - segmentStart : oneLineDuration;
  const segmentProgress = (progress - segmentStart) / segmentLength;
  const headlineOpacity = Math.min(ease(Math.min(1, segmentProgress / 0.12)), ease(Math.min(1, (1 - segmentProgress) / 0.12)));
  ctx.save();
  ctx.globalAlpha = headlineOpacity;
  roundRect(83, 434, 800, 130, 23, 'rgba(48,91,180,.24)', 'rgba(155,189,255,.27)');
  roundRect(105, 455, 50, 50, 15, 'rgba(131,169,255,.2)');
  label(line.glyph, 130, 480, 18, '#c7daff', 700, 'center');
  label(line.text, 177, 475, 22, '#fff', 700);
  label(line.sub, 177, 510, 12, '#c3d0e8', 500);
  ctx.restore();
  promiseLines.forEach((_, index) => {
    roundRect(105 + index * 29, 538, index === activePromise ? 20 : 6, 4, 3, index === activePromise ? '#9fbdff' : 'rgba(219,230,255,.38)');
  });

  label('EVERYDAY HR, ONE CONNECTED WORKSPACE', 540, 877, 10, '#b9cae9', 750, 'center');
  const tileWidth = 277;
  const tileHeight = 188;
  const gap = 22;
  moduleTiles.forEach((tile, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = 72 + column * (tileWidth + gap);
    const y = 931 + row * (tileHeight + gap);
    const delay = index * 0.07;
    const tileProgress = ease((progress - delay) * 3);
    ctx.save();
    ctx.globalAlpha = 0.36 + tileProgress * 0.64;
    ctx.translate(0, (1 - tileProgress) * 22);
    roundRect(x, y, tileWidth, tileHeight, 22, 'rgba(248,250,255,.97)', 'rgba(255,255,255,.45)');
    roundRect(x + 20, y + 21, 45, 45, 14, ['#e4edff', '#e4f4ef', '#ede8fb', '#fff0dc', '#e6effa', '#eaf0ff'][index]);
    label(tile.glyph, x + 42, y + 44, 16, '#385a9b', 750, 'center');
    label(tile.title, x + 21, y + 109, 15, '#213150', 740);
    label(tile.sub, x + 21, y + 138, 11, '#7e8ba2', 550);
    roundRect(x + 21, y + 161, 61 + (index % 2) * 21, 5, 3, '#d7e0ef');
    ctx.restore();
  });
}

function drawBrandReveal(time, progress) {
  sceneBackground(time, 1);
  const warmth = ctx.createRadialGradient(540, 774, 5, 540, 830, 760);
  warmth.addColorStop(0, 'rgba(44, 99, 212, .43)');
  warmth.addColorStop(1, 'rgba(10,20,49,0)');
  ctx.fillStyle = warmth;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  const reveal = smoothPop(progress * 4);
  ctx.globalAlpha = reveal;
  ctx.strokeStyle = 'rgba(152, 186, 252, .16)';
  ctx.lineWidth = 2;
  [-70, 0, 70].forEach((offset, index) => {
    ctx.beginPath();
    ctx.moveTo(97, 830 + offset);
    ctx.bezierCurveTo(316, 749 + offset, 759, 885 - offset, 983, 806 + offset);
    ctx.strokeStyle = `rgba(116, 160, 250, ${0.07 + index * 0.03})`;
    ctx.stroke();
  });

  const size = 110;
  if (brandMark.complete && brandMark.naturalWidth) {
    ctx.drawImage(brandMark, 484, 667, size, size);
  } else {
    roundRect(484, 667, size, size, 29, '#315cba');
    label('V', 539, 722, 48, '#fff', 750, 'center');
  }

  const wordmarkOpacity = ease((progress - 0.14) / 0.22);
  ctx.globalAlpha = reveal * wordmarkOpacity;
  label('Vettri', 540, 861, 65, '#ffffff', 750, 'center');
  label('HRMS', 540, 920, 26, '#a8c3ff', 750, 'center');
  ctx.restore();

  const taglineOpacity = ease((progress - 0.42) / 0.16);
  ctx.save();
  ctx.globalAlpha = taglineOpacity;
  label('Simple. Powerful. People-Focused.', 540, 1052, 21, '#f4f7ff', 520, 'center');
  ctx.restore();

  const websiteOpacity = ease((progress - 0.65) / 0.15);
  ctx.save();
  ctx.globalAlpha = websiteOpacity;
  roundRect(364, 1114, 352, 51, 26, 'rgba(255,255,255,.1)', 'rgba(215,227,255,.2)');
  label('www.vettrihrms.in', 540, 1140, 15, '#d4e2ff', 640, 'center');
  ctx.restore();
}

function renderVideoFrame(time) {
  const t = clamp(time, 0, DURATION - 0.001);
  if (t < 5) drawSceneOne(t, t / 5);
  else if (t < 10) drawDashboard(t - 5, (t - 5) / 5);
  else if (t < 20) drawAssistantScene(t - 10, (t - 10) / 10);
  else if (t < 29) drawProductFeatures(t - 20, (t - 20) / 9);
  else drawBrandReveal(t - 29, (t - 29) / 6);
}

function updateTransport(time) {
  const progress = clamp(time / DURATION, 0, 1);
  progressFill.style.width = `${progress * 100}%`;
  progressBar.setAttribute('aria-valuenow', String(Math.floor(progress * DURATION)));
  const seconds = Math.min(DURATION, Math.floor(time));
  timecode.textContent = `00:${String(seconds).padStart(2, '0')} / 00:35`;
}

let playbackStart = 0;
let elapsed = 0;
let playing = false;
let animationFrame = 0;
let audioContext = null;
let musicInterval = 0;
let playerGain = null;
let activeRecorder = null;
let exporting = false;

function drawPreview() {
  if (!exporting) {
    const now = performance.now();
    if (playing) elapsed = (now - playbackStart) / 1000;
    if (elapsed >= DURATION) {
      elapsed = DURATION;
      playing = false;
      stopMusic();
      overlay.classList.remove('is-hidden');
    }
    renderVideoFrame(elapsed);
    updateTransport(elapsed);
  }
  animationFrame = requestAnimationFrame(drawPreview);
}

function ensureMusic() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser does not support audio export.');
  if (audioContext) return audioContext.resume();

  audioContext = new AudioContextClass();
  playerGain = audioContext.createGain();
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 1700;
  lowPass.Q.value = 0.65;
  playerGain.gain.value = 0.0001;
  playerGain.connect(lowPass);
  lowPass.connect(audioContext.destination);

  const harmony = [
    [146.83, 220.0, 293.66],
    [123.47, 185.0, 246.94],
    [164.81, 246.94, 329.63],
    [110.0, 164.81, 220.0],
  ];
  const pads = [];
  harmony[0].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.065 : 0.023;
    oscillator.connect(gain);
    gain.connect(playerGain);
    oscillator.start();
    pads.push(oscillator);
  });

  let chordIndex = 0;
  let noteIndex = 0;
  const notes = harmony.map((chord) => [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[1] * 2]);
  playerGain.gain.setTargetAtTime(0.39, audioContext.currentTime, 1.4);
  musicInterval = window.setInterval(() => {
    if (!audioContext || !playerGain) return;
    const step = (noteIndex++) % 8;
    if (step === 0) {
      chordIndex = (chordIndex + 1) % harmony.length;
      pads.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(harmony[chordIndex][index], audioContext.currentTime, 0.22);
      });
    }
    const note = notes[chordIndex][step % notes[chordIndex].length];
    const pluck = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const tone = audioContext.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1250;
    pluck.type = 'sine';
    pluck.frequency.setValueAtTime(note, audioContext.currentTime);
    volume.gain.setValueAtTime(0.0001, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.075, audioContext.currentTime + 0.035);
    volume.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.66);
    pluck.connect(volume);
    volume.connect(tone);
    tone.connect(playerGain);
    pluck.start();
    pluck.stop(audioContext.currentTime + 0.7);
  }, 435);

  return audioContext.resume();
}

function stopMusic() {
  if (musicInterval) window.clearInterval(musicInterval);
  musicInterval = 0;
  if (playerGain && audioContext) {
    const closingContext = audioContext;
    playerGain.gain.setTargetAtTime(0.0001, closingContext.currentTime, 0.17);
    audioContext = null;
    playerGain = null;
    window.setTimeout(() => closingContext.close().catch(() => {}), 900);
  }
}

async function playFromStart() {
  try {
    await ensureMusic();
    elapsed = 0;
    playbackStart = performance.now();
    playing = true;
    overlay.classList.add('is-hidden');
  } catch (error) {
    exportStatus.textContent = error.message;
  }
}

function outputFormat() {
  const choices = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return choices.find((format) => MediaRecorder.isTypeSupported(format));
}

async function exportReel() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    exportStatus.textContent = 'Video export needs a browser that supports WebM recording.';
    return;
  }

  const format = outputFormat();
  if (!format) {
    exportStatus.textContent = 'This browser does not support a compatible WebM video format.';
    return;
  }

  recordButton.disabled = true;
  recordButton.querySelector('.export-label').textContent = 'Preparing your video…';
  playing = false;
  exporting = true;
  overlay.classList.add('is-hidden');

  let canvasStream;
  let recordingStream;
  try {
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
      playerGain = null;
      if (musicInterval) clearInterval(musicInterval);
      musicInterval = 0;
    }

    renderVideoFrame(0);
    canvasStream = canvas.captureStream(30);
    await ensureMusic();
    const audioStream = audioContext.createMediaStreamDestination();
    playerGain.disconnect();
    playerGain.connect(audioStream);

    recordingStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(recordingStream, {
      mimeType: format,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 160_000,
    });
    const extension = format.startsWith('video/mp4') ? 'mp4' : 'webm';
    activeRecorder = recorder;
    const chunks = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    const recordingStart = performance.now();
    recorder.addEventListener('stop', () => {
      const video = new Blob(chunks, { type: format });
      if (video.size === 0) {
        exportStatus.textContent = 'The video export was empty. Please try again.';
        recordButton.disabled = false;
        recordButton.querySelector('.export-label').textContent = 'Export social-ready video';
        exporting = false;
        overlay.classList.remove('is-hidden');
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(video);
      link.download = `vettri-hrms-brand-reel.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
      exportStatus.textContent = `Your 1080 × 1920 reel is ready. ${extension.toUpperCase()} video with original soundtrack.`;
      recordButton.querySelector('.export-label').textContent = 'Export social-ready video';
      recordButton.disabled = false;
      exporting = false;
      overlay.classList.remove('is-hidden');
      activeRecorder = null;
      canvasStream.getTracks().forEach((track) => track.stop());
      recordingStream.getTracks().forEach((track) => track.stop());
      audioContext?.close().catch(() => {});
      audioContext = null;
      playerGain = null;
      musicInterval = 0;
    });

    await audioContext.resume();
    recorder.start(1000);
    recordButton.querySelector('.export-label').textContent = 'Rendering 0 of 35 seconds…';
    function captureFrame() {
      if (!activeRecorder || activeRecorder.state !== 'recording') return;
      const elapsedTime = Math.min(DURATION, (performance.now() - recordingStart) / 1000);
      renderVideoFrame(elapsedTime);
      updateTransport(elapsedTime);
      const remaining = Math.max(0, Math.ceil(DURATION - elapsedTime));
      recordButton.querySelector('.export-label').textContent = `Rendering ${DURATION - remaining} of 35 seconds…`;
      if (elapsedTime >= DURATION) {
        playerGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.25);
        recorder.stop();
        return;
      }
      requestAnimationFrame(captureFrame);
    }
    requestAnimationFrame(captureFrame);
  } catch (error) {
    canvasStream?.getTracks().forEach((track) => track.stop());
    recordingStream?.getTracks().forEach((track) => track.stop());
    activeRecorder = null;
    if (audioContext) await audioContext.close().catch(() => {});
    audioContext = null;
    playerGain = null;
    if (musicInterval) clearInterval(musicInterval);
    musicInterval = 0;
    recordButton.disabled = false;
    recordButton.querySelector('.export-label').textContent = 'Export social-ready video';
    exporting = false;
    overlay.classList.remove('is-hidden');
    exportStatus.textContent = `Could not export the video: ${error.message}`;
  }
}

const initialFormat = outputFormat();
if (initialFormat) {
  recordButton.querySelector('.export-label').textContent = initialFormat.startsWith('video/mp4')
    ? 'Export MP4 for social'
    : 'Export vertical video';
}

playButton.addEventListener('click', playFromStart);
restartButton.addEventListener('click', playFromStart);
recordButton.addEventListener('click', exportReel);
progressBar.addEventListener('click', (event) => {
  if (playing || recordButton.disabled) return;
  const bounds = progressBar.getBoundingClientRect();
  const amount = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  elapsed = amount * DURATION;
  renderVideoFrame(elapsed);
  updateTransport(elapsed);
  overlay.classList.remove('is-hidden');
});
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(animationFrame);
  if (activeRecorder?.state === 'recording') activeRecorder.stop();
  exporting = false;
  stopMusic();
});

renderVideoFrame(0);
drawPreview();
