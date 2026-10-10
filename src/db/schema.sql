-- Schema for the church website API. Safe to run repeatedly (IF NOT EXISTS).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name       TEXT    NOT NULL,
  last_name        TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  phone            TEXT,
  address          TEXT,
  membership_status TEXT   NOT NULL DEFAULT 'visitor'
                   CHECK (membership_status IN ('visitor', 'member', 'minister', 'volunteer')),
  family_group     TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  joined_at        TEXT,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email      ON members (email);
CREATE INDEX        IF NOT EXISTS idx_members_status     ON members (membership_status, is_active);
CREATE INDEX        IF NOT EXISTS idx_members_last_name  ON members (last_name);
CREATE INDEX        IF NOT EXISTS idx_members_family     ON members (family_group);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  description  TEXT,
  category     TEXT    NOT NULL DEFAULT 'service'
               CHECK (category IN ('service', 'fellowship', 'conference', 'outreach', 'meeting', 'other')),
  location     TEXT,
  starts_at    TEXT    NOT NULL,
  ends_at      TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category  ON events (category, starts_at);

CREATE TABLE IF NOT EXISTS sermons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  speaker          TEXT    NOT NULL,
  series           TEXT,
  scripture        TEXT,
  summary          TEXT,
  media_type       TEXT    NOT NULL DEFAULT 'audio'
                   CHECK (media_type IN ('audio', 'video', 'text')),
  media_url        TEXT,
  duration_seconds INTEGER,
  published_at     TEXT    NOT NULL,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sermons_published ON sermons (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_speaker   ON sermons (speaker);
CREATE INDEX IF NOT EXISTS idx_sermons_series    ON sermons (series);

CREATE TABLE IF NOT EXISTS members_events (
  member_id INTEGER NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  event_id  INTEGER NOT NULL REFERENCES events (id)  ON DELETE CASCADE,
  rsvp_at   TEXT    NOT NULL,
  PRIMARY KEY (member_id, event_id)
);

CREATE TABLE IF NOT EXISTS giving (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER REFERENCES members (id) ON DELETE SET NULL,
  amount     REAL    NOT NULL CHECK (amount > 0),
  currency   TEXT    NOT NULL DEFAULT 'USD',
  method     TEXT    NOT NULL DEFAULT 'cash'
             CHECK (method IN ('cash', 'card', 'transfer', 'online', 'cheque')),
  fund       TEXT    NOT NULL DEFAULT 'offering'
             CHECK (fund IN ('tithe', 'offering', 'missions', 'building', 'benevolence', 'other')),
  reference  TEXT,
  notes      TEXT,
  given_at   TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_giving_member  ON giving (member_id);
CREATE INDEX IF NOT EXISTS idx_giving_given   ON giving (given_at DESC);
CREATE INDEX IF NOT EXISTS idx_giving_fund    ON giving (fund, given_at DESC);

CREATE TABLE IF NOT EXISTS prayer_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  email        TEXT,
  request      TEXT    NOT NULL,
  is_public    INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'declined', 'answered')),
  submitted_at TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prayers_status ON prayer_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_prayers_public ON prayer_requests (is_public, status);

CREATE TABLE IF NOT EXISTS announcements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  author       TEXT,
  priority     TEXT    NOT NULL DEFAULT 'normal'
               CHECK (priority IN ('normal', 'important', 'urgent')),
  is_published INTEGER NOT NULL DEFAULT 1,
  publish_at   TEXT,
  expires_at   TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_live ON announcements (is_published, priority, publish_at DESC);
