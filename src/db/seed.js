import process from 'node:process';
import { db } from './index.js';

const reset = process.argv.includes('--reset');
const now = Date.now();
const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();
const DAY = 86_400_000;

const FIRST = [
  'Ada', 'John', 'Grace', 'Peter', 'Ruth', 'Daniel', 'Esther', 'Samuel', 'Joy', 'Emmanuel',
  'Rebecca', 'Michael', 'Naomi', 'David', 'Hannah', 'Josiah', 'Deborah', 'Timothy', 'Sarah', 'Paul',
  'Miriam', 'Samson', 'Lydia', 'Aaron', 'Abigail',
];
const LAST = [
  'Okafor', 'Adeyemi', 'Johnson', 'Nwosu', 'Bello', 'Eze', 'Obi', 'Bakare', 'Aina', 'Uche',
  'Olawale', 'Ibrahim', 'Damascus', 'Mensah', 'Kamara',
];
const STATUS = ['member', 'member', 'member', 'visitor', 'volunteer', 'minister'];
const GROUPS = ['Believers Fellowship', 'Youth Cell', 'Choir Unit', 'Ushering Unit', null, null];

const EVENTS = [
  ['Sunday Worship Service', 'service', 'Main Sanctuary', 3],
  ['Bible Study', 'service', 'Hall B', 5],
  ['Youth Fellowship', 'fellowship', 'Youth Hall', 7],
  ['Choir Rehearsal', 'meeting', 'Music Room', 2],
  ['Prayer Meeting', 'service', 'Main Sanctuary', 4],
  ['Community Outreach', 'outreach', 'Market Square', 10],
  ['Leadership Conference', 'conference', 'Main Sanctuary', 21],
  ['Thanksgiving Service', 'service', 'Main Sanctuary', 30],
  ['Workers Meeting', 'meeting', 'Hall B', -3],
  ['Family Thanksgiving', 'fellowship', 'Church Grounds', -9],
  ['Youth Night', 'fellowship', 'Youth Hall', -15],
  ['Quarterly Review', 'meeting', 'Conference Room', -22],
];

const SERMONS = [
  ['Mountains Can Move', 'Rev. Samuel Okafor', 'Faith That Works', 'Mark 11:23', 'video'],
  ['The Power of Thanksgiving', 'Pastor Grace Adeyemi', 'A Grateful Heart', 'Psalm 100:4', 'audio'],
  ['Walking in Wisdom', 'Rev. Samuel Okafor', 'Wisdom for Living', 'James 1:5', 'video'],
  ['Love Without Limits', 'Pastor John Eze', 'Agape', '1 Corinthians 13:4', 'audio'],
  ['Rest for the Weary', 'Pastor Grace Adeyemi', 'The Easy Yoke', 'Matthew 11:28', 'text'],
  ['Built on the Rock', 'Rev. Samuel Okafor', 'Foundations', 'Matthew 7:24', 'video'],
  ['A Generous Heart', 'Pastor John Eze', 'Kingdom Stewardship', '2 Corinthians 9:7', 'audio'],
  ['When Prayers Wait', 'Pastor Ruth Nwosu', 'Seasons of Waiting', 'Psalm 27:14', 'audio'],
  ['The Spirit of Excellence', 'Rev. Samuel Okafor', 'Excellent Living', 'Colossians 3:23', 'video'],
  ['Joy in the Morning', 'Pastor Grace Adeyemi', 'A Grateful Heart', 'Psalm 30:5', 'text'],
];

const FUNDS = ['tithe', 'offering', 'missions', 'building', 'benevolence'];
const METHODS = ['cash', 'card', 'transfer', 'online'];
const PRAYERS = [
  ['Anonymous', 'Please pray for my upcoming examinations.', 1, 'approved'],
  ['Mary', 'Pray for the healing of my mother.', 0, 'pending'],
  ['Tunde', 'Thank God for a new job.', 1, 'answered'],
  ['Anonymous', 'Pray for peace in our community.', 1, 'approved'],
  ['Blessing', 'Pray for my family reconciliation.', 0, 'pending'],
  ['Chidi', 'Pray for provision for school fees.', 0, 'declined'],
];
const ANNOUNCEMENTS = [
  ['Annual Convention Begins Next Month', 'Our annual convention runs from the first Friday of next month. Plan to attend.', 'urgent'],
  ['New Member Class', 'Registration for the new members class is now open at the information desk.', 'important'],
  ['Choir Auditions', 'Auditions for the mass choir hold every Saturday this month.', 'normal'],
  ['Sanctuary Renovation', 'The west wing will be closed for renovation for two weeks.', 'important'],
  ['Sunday Service Time Changed', 'Service now starts at 8:00 AM prompt.', 'normal'],
];

function seed() {
  if (reset) {
    db.exec(`
      DELETE FROM members_events;
      DELETE FROM giving;
      DELETE FROM prayer_requests;
      DELETE FROM announcements;
      DELETE FROM sermons;
      DELETE FROM events;
      DELETE FROM members;
      DELETE FROM sqlite_sequence;
    `);
    console.log('Existing data cleared.');
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
  if (count > 0) {
    console.log(`Database already has ${count} members — skipping. Use "npm run reset" to reseed.`);
    return;
  }

  const insertMember = db.prepare(`
    INSERT INTO members (first_name, last_name, email, phone, address, membership_status,
                         family_group, is_active, joined_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const memberIds = [];
  for (let i = 0; i < FIRST.length; i += 1) {
    const joinedAt = iso(-((i + 1) * 20 * DAY));
    const info = insertMember.run(
      FIRST[i],
      LAST[i % LAST.length],
      `${FIRST[i].toLowerCase()}.${LAST[i % LAST.length].toLowerCase()}@example.org`,
      `+234 80${String(10000000 + i * 137).slice(0, 8)}`,
      `${12 + i} Church Road, Lagos`,
      STATUS[i % STATUS.length],
      GROUPS[i % GROUPS.length],
      i % 9 === 0 ? 0 : 1,
      joinedAt,
      joinedAt,
      joinedAt,
    );
    memberIds.push(info.lastInsertRowid);
  }
  console.log(`Seeded ${memberIds.length} members.`);

  const insertEvent = db.prepare(`
    INSERT INTO events (title, description, category, location, starts_at, ends_at, is_recurring, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [title, category, location, offsetDays] of EVENTS) {
    const startsAt = iso(offsetDays * DAY);
    insertEvent.run(
      title,
      `Join us for ${title.toLowerCase()}.`,
      category,
      location,
      startsAt,
      iso(offsetDays * DAY + 2 * 3600_000),
      category === 'service' ? 1 : 0,
      iso(-5 * DAY),
      iso(-5 * DAY),
    );
  }
  console.log(`Seeded ${EVENTS.length} events.`);

  const insertSermon = db.prepare(`
    INSERT INTO sermons (title, speaker, series, scripture, summary, media_type, media_url,
                         duration_seconds, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  SERMONS.forEach(([title, speaker, series, scripture, mediaType], index) => {
    const publishedAt = iso(-(index + 1) * 7 * DAY);
    insertSermon.run(
      title,
      speaker,
      series,
      scripture,
      `${title} — a message from the ${series} series.`,
      mediaType,
      `https://media.example.org/sermons/${title.toLowerCase().replace(/\s+/g, '-')}.${mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'html'}`,
      mediaType === 'text' ? null : 45 * 60,
      publishedAt,
      publishedAt,
      publishedAt,
    );
  });
  console.log(`Seeded ${SERMONS.length} sermons.`);

  const insertGiving = db.prepare(`
    INSERT INTO giving (member_id, amount, currency, method, fund, reference, notes, given_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < 40; i += 1) {
    const givenAt = iso(-(i * 2) * DAY);
    insertGiving.run(
      i % 4 === 0 ? null : memberIds[i % memberIds.length],
      Number(((i % 7) + 1) * 25 + (i % 5) * 10),
      'USD',
      METHODS[i % METHODS.length],
      FUNDS[i % FUNDS.length],
      `REF-${1000 + i}`,
      i % 6 === 0 ? 'Family offering' : null,
      givenAt,
      givenAt,
    );
  }
  console.log('Seeded 40 giving records.');

  const insertPrayer = db.prepare(`
    INSERT INTO prayer_requests (name, email, request, is_public, status, submitted_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [name, request, isPublic, status] of PRAYERS) {
    const submittedAt = iso(-Math.random() * 10 * DAY);
    insertPrayer.run(name, null, request, isPublic, status, submittedAt, submittedAt);
  }
  console.log(`Seeded ${PRAYERS.length} prayer requests.`);

  const insertAnnouncement = db.prepare(`
    INSERT INTO announcements (title, body, author, priority, is_published, publish_at, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
  `);
  ANNOUNCEMENTS.forEach(([title, body, priority], index) => {
    const createdAt = iso(-(index + 1) * DAY);
    insertAnnouncement.run(title, body, 'Church Office', priority, createdAt, null, createdAt, createdAt);
  });
  console.log(`Seeded ${ANNOUNCEMENTS.length} announcements.`);

  console.log('Done.');
}

seed();
