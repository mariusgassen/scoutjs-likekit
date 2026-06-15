package org.scoutkit.meeting.conversation;

import java.util.List;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.rest.IRestResource;
import org.scoutkit.meeting.model.Conversation;
import org.scoutkit.meeting.model.Message;
import org.scoutkit.meeting.model.NewConversation;
import org.scoutkit.meeting.model.NewMessage;

/**
 * REST API for conversations and their persistent messages:
 * <ul>
 *   <li>{@code GET  /api/conversations}</li>
 *   <li>{@code POST /api/conversations}</li>
 *   <li>{@code GET  /api/conversations/{id}/messages?after=<ts>}</li>
 *   <li>{@code POST /api/conversations/{id}/messages}</li>
 * </ul>
 */
@Path("conversations")
public class ConversationResource implements IRestResource {

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public List<Conversation> list() {
    return BEANS.get(ConversationService.class).list();
  }

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Conversation create(NewConversation req) {
    return BEANS.get(ConversationService.class).create(req);
  }

  @GET
  @Path("/{id}/messages")
  @Produces(MediaType.APPLICATION_JSON)
  public List<Message> messages(@PathParam("id") String id, @QueryParam("after") @DefaultValue("0") long after) {
    return BEANS.get(ConversationService.class).messages(id, after);
  }

  @POST
  @Path("/{id}/messages")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  public Message postMessage(@PathParam("id") String id, NewMessage req) {
    return BEANS.get(ConversationService.class).addMessage(id, req);
  }
}
