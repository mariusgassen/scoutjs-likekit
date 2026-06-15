-- Seed a small demo directory and a default "General" room so a fresh database is immediately
-- usable. Runs once (Flyway tracks it); equivalent to the old "seed only when empty" Java code.

insert into contact (id, name, email, status, color) values
  ('alice', 'Alice Anderson', 'alice@example.com', 'online',  '#e8615b'),
  ('bob',   'Bob Brown',      'bob@example.com',   'online',  '#3b82f6'),
  ('carol', 'Carol Clark',    'carol@example.com', 'away',    '#10b981'),
  ('dave',  'Dave Davis',     'dave@example.com',  'offline', '#a855f7'),
  ('erin',  'Erin Evans',     'erin@example.com',  'online',  '#f59e0b');

insert into conversation (id, type, title, created_ts) values
  ('general', 'group', 'General', (extract(epoch from now()) * 1000)::bigint);

insert into conversation_member (conversation_id, contact_id)
  select 'general', id from contact;

insert into message (id, conversation_id, author, text, created_ts) values
  ('seed-welcome', 'general', 'Alice Anderson',
   'Welcome to the team workspace! Start a call any time — this chat stays here afterwards.',
   (extract(epoch from now()) * 1000)::bigint);
