package org.scoutkit.meeting.contact;

import static org.scoutkit.meeting.jooq.Tables.CONTACT;

import java.util.List;
import java.util.Optional;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.BEANS;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.scoutkit.meeting.conversation.ConversationService;
import org.scoutkit.meeting.data.Database;
import org.scoutkit.meeting.model.Contact;

/** Reads the workspace contact directory (jOOQ over PostgreSQL). */
@ApplicationScoped
public class ContactService {

  public List<Contact> list() {
    return db()
        .select(CONTACT.ID, CONTACT.NAME, CONTACT.EMAIL, CONTACT.STATUS, CONTACT.COLOR)
        .from(CONTACT)
        .orderBy(CONTACT.NAME)
        .fetch(ContactService::toContact);
  }

  /**
   * Global search over the contact directory: a contact matches when its name, email or status
   * contains every (whitespace-separated) token of the query (case-insensitive). Backs
   * {@code GET /api/search/contacts}.
   */
  public List<Contact> search(String query, int limit) {
    List<String> tokens = ConversationService.searchTokens(query);
    if (tokens.isEmpty()) {
      return List.of();
    }
    int max = Math.max(1, Math.min(limit, 100));

    Condition condition = DSL.noCondition();
    for (String token : tokens) {
      String pattern = "%" + token + "%";
      condition = condition.and(DSL.lower(CONTACT.NAME).like(pattern)
          .or(DSL.lower(CONTACT.EMAIL).like(pattern))
          .or(DSL.lower(CONTACT.STATUS).like(pattern)));
    }

    return db()
        .select(CONTACT.ID, CONTACT.NAME, CONTACT.EMAIL, CONTACT.STATUS, CONTACT.COLOR)
        .from(CONTACT)
        .where(condition)
        .orderBy(CONTACT.NAME)
        .limit(max)
        .fetch(ContactService::toContact);
  }

  public Optional<Contact> getById(String id) {
    return db()
        .select(CONTACT.ID, CONTACT.NAME, CONTACT.EMAIL, CONTACT.STATUS, CONTACT.COLOR)
        .from(CONTACT)
        .where(CONTACT.ID.eq(id))
        .fetchOptional(ContactService::toContact);
  }

  protected static Contact toContact(Record r) {
    return new Contact(r.get(CONTACT.ID), r.get(CONTACT.NAME), r.get(CONTACT.EMAIL),
        r.get(CONTACT.STATUS), r.get(CONTACT.COLOR));
  }

  protected DSLContext db() {
    return BEANS.get(Database.class).db();
  }
}
