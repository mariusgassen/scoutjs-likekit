-- Core schema for ScoutKit: the workspace contact directory, conversations (DMs + group/meeting
-- rooms), their members, and the persistent chat messages. This file is the single source of
-- truth for both the runtime schema (applied by Flyway) and the compile-time jOOQ code generation
-- (jOOQ's DDLDatabase parses exactly this file). Keep it portable, standard DDL.

create table contact (
  id     varchar(64) primary key,
  name   varchar(255) not null,
  email  varchar(255),
  status varchar(32),
  color  varchar(16)
);

create table conversation (
  id         varchar(64) primary key,
  type       varchar(16) not null,
  title      varchar(255),
  created_ts bigint not null
);

create table conversation_member (
  conversation_id varchar(64) not null references conversation (id),
  contact_id      varchar(64) not null references contact (id),
  primary key (conversation_id, contact_id)
);

create table message (
  id              varchar(64) primary key,
  conversation_id varchar(64) not null references conversation (id),
  author          varchar(255) not null,
  text            varchar(4000) not null,
  created_ts      bigint not null
);

create index idx_message_conv on message (conversation_id, created_ts);
