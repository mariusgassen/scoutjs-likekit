package org.scoutkit.meeting.contact;

import static org.scoutkit.meeting.jooq.Tables.CONTACT;

import java.util.List;
import java.util.Optional;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.BEANS;
import org.jooq.DSLContext;
import org.jooq.Record;
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
