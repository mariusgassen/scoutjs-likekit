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
import org.scoutkit.meeting.model.MessageHit;

/**
 * {@code GET /api/search?q=<query>&limit=<n>} — PostgreSQL full-text search across all chat
 * messages. Returns ranked {@link MessageHit hits} with highlighted snippets.
 */
@Path("search")
public class SearchResource implements IRestResource {

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public List<MessageHit> search(@QueryParam("q") String q, @QueryParam("limit") @DefaultValue("30") int limit) {
    return BEANS.get(ConversationService.class).search(q, limit);
  }
}
