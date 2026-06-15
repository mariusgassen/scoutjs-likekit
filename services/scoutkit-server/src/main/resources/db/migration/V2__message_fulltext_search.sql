-- Full-text message search (PostgreSQL-specific; deliberately NOT fed to jOOQ codegen).
--
-- `search_tsv` is a STORED generated column: PostgreSQL maintains a normalized `tsvector`
-- (author + text) on every insert/update, and the GIN index makes `@@` queries fast. The
-- search query itself lives in ConversationService#search, which references this column via
-- jOOQ plain SQL (websearch_to_tsquery / ts_rank / ts_headline).

alter table message
  add column search_tsv tsvector
  generated always as (
    to_tsvector('english', coalesce(author, '') || ' ' || coalesce(text, ''))
  ) stored;

create index idx_message_search on message using gin (search_tsv);
