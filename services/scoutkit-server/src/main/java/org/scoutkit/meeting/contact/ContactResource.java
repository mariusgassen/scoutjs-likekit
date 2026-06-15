package org.scoutkit.meeting.contact;

import java.util.List;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.rest.IRestResource;
import org.scoutkit.meeting.model.Contact;

/** {@code GET /api/contacts} — the workspace contact directory. */
@Path("contacts")
public class ContactResource implements IRestResource {

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public List<Contact> list() {
    return BEANS.get(ContactService.class).list();
  }
}
