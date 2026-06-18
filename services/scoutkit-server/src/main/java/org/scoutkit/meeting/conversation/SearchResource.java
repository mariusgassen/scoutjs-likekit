package org.scoutkit.meeting.conversation;

import java.util.List;

import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.rest.IRestResource;
import org.scoutkit.meeting.contact.ContactService;
import org.scoutkit.meeting.model.Contact;
import org.scoutkit.meeting.model.Conversation;
import org.scoutkit.meeting.model.MessageHit;

/**
 * Global search across the workspace, exposed under {@code /api/search}:
 * <ul>
 *   <li>{@code GET /api/search/conversations?q=<query>&limit=<n>} — conversations by title/member</li>
 *   <li>{@code GET /api/search/contacts?q=<query>&limit=<n>} — contacts by name/email/status</li>
 *   <li>{@code GET /api/search/messages?q=<query>&limit=<n>} — PostgreSQL full-text message search</li>
 * </ul>
 */
@Path("search")
public class SearchResource implements IRestResource {

  @GET
  @Path("/conversations")
  @Produces(MediaType.APPLICATION_JSON)
  public List<Conversation> conversations(@QueryParam("q") String q, @QueryParam("limit") @DefaultValue("30") int limit) {
    return BEANS.get(ConversationService.class).searchConversations(q, limit);
  }

  @GET
  @Path("/contacts")
  @Produces(MediaType.APPLICATION_JSON)
  public List<Contact> contacts(@QueryParam("q") String q, @QueryParam("limit") @DefaultValue("30") int limit) {
    return BEANS.get(ContactService.class).search(q, limit);
  }

  @GET
  @Path("/messages")
  @Produces(MediaType.APPLICATION_JSON)
  public List<MessageHit> messages(@QueryParam("q") String q, @QueryParam("limit") @DefaultValue("30") int limit) {
    return BEANS.get(ConversationService.class).search(q, limit);
  }
}
