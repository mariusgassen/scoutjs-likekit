package org.scoutkit.meeting.conversation;

import static org.scoutkit.meeting.jooq.Tables.CONTACT;
import static org.scoutkit.meeting.jooq.Tables.CONVERSATION;
import static org.scoutkit.meeting.jooq.Tables.CONVERSATION_MEMBER;
import static org.scoutkit.meeting.jooq.Tables.MESSAGE;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.util.StringUtility;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.scoutkit.meeting.data.Database;
import org.scoutkit.meeting.model.Conversation;
import org.scoutkit.meeting.model.Message;
import org.scoutkit.meeting.model.MessageHit;
import org.scoutkit.meeting.model.NewConversation;
import org.scoutkit.meeting.model.NewMessage;

/**
 * Conversations (DMs + group/meeting chats) and their persistent messages, backed by PostgreSQL
 * via jOOQ. Chat history lives here independently of any LiveKit call, so it outlives the call —
 * including multi-person meetings (the conversation id doubles as the LiveKit room name).
 */
@ApplicationScoped
public class ConversationService {

  public List<Conversation> list() {
    DSLContext db = db();
    List<Conversation> result = db
        .select(CONVERSATION.ID, CONVERSATION.TYPE, CONVERSATION.TITLE, CONVERSATION.CREATED_TS)
        .from(CONVERSATION)
        .fetch(r -> readConversation(db, r.get(CONVERSATION.ID), r.get(CONVERSATION.TYPE),
            r.get(CONVERSATION.TITLE), r.get(CONVERSATION.CREATED_TS)));
    result.sort((a, b) -> Long.compare(b.lastTs(), a.lastTs()));
    return result;
  }

  public Optional<Conversation> get(String id) {
    DSLContext db = db();
    return db
        .select(CONVERSATION.ID, CONVERSATION.TYPE, CONVERSATION.TITLE, CONVERSATION.CREATED_TS)
        .from(CONVERSATION)
        .where(CONVERSATION.ID.eq(id))
        .fetchOptional(r -> readConversation(db, r.get(CONVERSATION.ID), r.get(CONVERSATION.TYPE),
            r.get(CONVERSATION.TITLE), r.get(CONVERSATION.CREATED_TS)));
  }

  public Conversation create(NewConversation req) {
    String type = StringUtility.hasText(req.type()) ? req.type() : "group";
    String id = ("direct".equals(type) ? "dm-" : "grp-") + UUID.randomUUID().toString().substring(0, 8);
    long now = System.currentTimeMillis();
    List<String> memberIds = req.memberIds() != null ? req.memberIds() : List.of();

    DSLContext db = db();
    db.transaction(tx -> {
      DSLContext t = tx.dsl();
      t.insertInto(CONVERSATION)
          .set(CONVERSATION.ID, id)
          .set(CONVERSATION.TYPE, type)
          .set(CONVERSATION.TITLE, req.title())
          .set(CONVERSATION.CREATED_TS, now)
          .execute();
      if (!memberIds.isEmpty()) {
        var batch = memberIds.stream()
            .map(contactId -> t.insertInto(CONVERSATION_MEMBER)
                .set(CONVERSATION_MEMBER.CONVERSATION_ID, id)
                .set(CONVERSATION_MEMBER.CONTACT_ID, contactId))
            .toList();
        t.batch(batch).execute();
      }
    });
    return readConversation(db, id, type, req.title(), now);
  }

  /**
   * Global search over conversations: a conversation matches when its title or any member contact's
   * name/email contains every (whitespace-separated) token of the query (case-insensitive). Backs
   * {@code GET /api/search/conversations}.
   */
  public List<Conversation> searchConversations(String query, int limit) {
    List<String> tokens = searchTokens(query);
    if (tokens.isEmpty()) {
      return List.of();
    }
    int max = Math.max(1, Math.min(limit, 100));
    DSLContext db = db();

    Condition condition = DSL.noCondition();
    for (String token : tokens) {
      String pattern = "%" + token + "%";
      Condition memberMatch = DSL.exists(DSL.selectOne()
          .from(CONVERSATION_MEMBER)
          .join(CONTACT).on(CONTACT.ID.eq(CONVERSATION_MEMBER.CONTACT_ID))
          .where(CONVERSATION_MEMBER.CONVERSATION_ID.eq(CONVERSATION.ID))
          .and(DSL.lower(CONTACT.NAME).like(pattern).or(DSL.lower(CONTACT.EMAIL).like(pattern))));
      condition = condition.and(DSL.lower(CONVERSATION.TITLE).like(pattern).or(memberMatch));
    }

    List<Conversation> result = db
        .select(CONVERSATION.ID, CONVERSATION.TYPE, CONVERSATION.TITLE, CONVERSATION.CREATED_TS)
        .from(CONVERSATION)
        .where(condition)
        .orderBy(CONVERSATION.TITLE)
        .limit(max)
        .fetch(r -> readConversation(db, r.get(CONVERSATION.ID), r.get(CONVERSATION.TYPE),
            r.get(CONVERSATION.TITLE), r.get(CONVERSATION.CREATED_TS)));
    result.sort((a, b) -> Long.compare(b.lastTs(), a.lastTs()));
    return result;
  }

  public List<Message> messages(String conversationId, long afterTs) {
    return db()
        .select(MESSAGE.ID, MESSAGE.CONVERSATION_ID, MESSAGE.AUTHOR, MESSAGE.TEXT, MESSAGE.CREATED_TS)
        .from(MESSAGE)
        .where(MESSAGE.CONVERSATION_ID.eq(conversationId))
        .and(MESSAGE.CREATED_TS.gt(afterTs))
        .orderBy(MESSAGE.CREATED_TS.asc(), MESSAGE.ID.asc())
        .fetch(r -> new Message(r.get(MESSAGE.ID), r.get(MESSAGE.CONVERSATION_ID),
            r.get(MESSAGE.AUTHOR), r.get(MESSAGE.TEXT), r.get(MESSAGE.CREATED_TS)));
  }

  public Message addMessage(String conversationId, NewMessage req) {
    String id = "msg-" + UUID.randomUUID();
    long now = System.currentTimeMillis();
    String author = StringUtility.hasText(req.author()) ? req.author() : "Anonymous";
    String text = req.text() != null ? req.text() : "";
    db()
        .insertInto(MESSAGE)
        .set(MESSAGE.ID, id)
        .set(MESSAGE.CONVERSATION_ID, conversationId)
        .set(MESSAGE.AUTHOR, author)
        .set(MESSAGE.TEXT, text)
        .set(MESSAGE.CREATED_TS, now)
        .execute();
    return new Message(id, conversationId, author, text, now);
  }

  /**
   * Full-text search across all chat messages, powered by PostgreSQL's text search. The
   * {@code search_tsv} column (a stored, GIN-indexed {@code tsvector}; see migration V2) is matched
   * with {@code websearch_to_tsquery} (Google-style query syntax), ranked by {@code ts_rank}, and
   * each hit carries a highlighted {@code ts_headline} snippet. Referenced via jOOQ plain SQL
   * because the FTS column is intentionally outside the generated meta-model.
   */
  public List<MessageHit> search(String query, int limit) {
    if (!StringUtility.hasText(query)) {
      return List.of();
    }
    int max = Math.max(1, Math.min(limit, 100));
    Field<Object> tsquery = DSL.field("websearch_to_tsquery('english', {0})", Object.class, DSL.val(query));
    // search_tsv is intentionally outside the generated meta-model (PostgreSQL tsvector, migration V2).
    Field<Object> tsvector = DSL.field(DSL.name(MESSAGE.getName(), "search_tsv"));
    Field<Double> rank = DSL.field("ts_rank({0}, {1})", Double.class, tsvector, tsquery);
    Field<String> snippet = DSL.field(
        "ts_headline('english', {0}, {1}, 'StartSel=[, StopSel=], MaxFragments=2, MaxWords=18, MinWords=5')",
        String.class, MESSAGE.TEXT, tsquery);

    Field<Integer> memberCount = DSL.field(DSL.selectCount()
        .from(CONVERSATION_MEMBER)
        .where(CONVERSATION_MEMBER.CONVERSATION_ID.eq(CONVERSATION.ID)));

    return db()
        .select(MESSAGE.ID, MESSAGE.CONVERSATION_ID, MESSAGE.AUTHOR, MESSAGE.CREATED_TS,
            CONVERSATION.TITLE, CONVERSATION.TYPE, memberCount.as("member_count"), snippet.as("snippet"))
        .from(MESSAGE)
        .join(CONVERSATION).on(CONVERSATION.ID.eq(MESSAGE.CONVERSATION_ID))
        .where(DSL.condition("{0} @@ {1}", tsvector, tsquery))
        .orderBy(rank.desc(), MESSAGE.CREATED_TS.desc())
        .limit(max)
        .fetch(r -> new MessageHit(
            r.get(MESSAGE.ID),
            r.get(MESSAGE.CONVERSATION_ID),
            r.get(CONVERSATION.TITLE),
            r.get(CONVERSATION.TYPE),
            r.get("member_count", Integer.class),
            r.get(MESSAGE.AUTHOR),
            r.get("snippet", String.class),
            r.get(MESSAGE.CREATED_TS)));
  }

  protected Conversation readConversation(DSLContext db, String id, String type, String title, long createdTs) {
    List<String> memberIds = db
        .select(CONVERSATION_MEMBER.CONTACT_ID)
        .from(CONVERSATION_MEMBER)
        .where(CONVERSATION_MEMBER.CONVERSATION_ID.eq(id))
        .fetch(CONVERSATION_MEMBER.CONTACT_ID);

    return db
        .select(MESSAGE.AUTHOR, MESSAGE.TEXT, MESSAGE.CREATED_TS)
        .from(MESSAGE)
        .where(MESSAGE.CONVERSATION_ID.eq(id))
        .orderBy(MESSAGE.CREATED_TS.desc(), MESSAGE.ID.desc())
        .limit(1)
        .fetchOptional()
        .map(r -> new Conversation(id, type, title, memberIds, memberIds.size(),
            r.get(MESSAGE.TEXT), r.get(MESSAGE.AUTHOR), r.get(MESSAGE.CREATED_TS)))
        .orElseGet(() -> new Conversation(id, type, title, memberIds, memberIds.size(), null, null, createdTs));
  }

  /** Lower-cased, non-blank, wildcard-stripped tokens of a search query (empty when nothing usable). */
  public static List<String> searchTokens(String query) {
    if (!StringUtility.hasText(query)) {
      return List.of();
    }
    return Arrays.stream(query.toLowerCase().replace("*", "").trim().split("\\s+"))
        .filter(StringUtility::hasText)
        .toList();
  }

  protected DSLContext db() {
    return BEANS.get(Database.class).db();
  }
}
