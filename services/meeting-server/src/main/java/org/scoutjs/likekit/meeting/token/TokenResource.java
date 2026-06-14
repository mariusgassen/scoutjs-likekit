package org.scoutjs.likekit.meeting.token;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.util.StringUtility;
import org.eclipse.scout.rt.rest.IRestResource;

/**
 * {@code GET /api/token?room=&identity=&name=} — mints a LiveKit join token. Keeps the same
 * contract the Scout JS {@code HttpTokenProvider} already expects.
 */
@Path("token")
public class TokenResource implements IRestResource {

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public TokenResponse token(@QueryParam("room") String room,
      @QueryParam("identity") String identity,
      @QueryParam("name") String name) {
    if (!StringUtility.hasText(room) || !StringUtility.hasText(identity)) {
      throw new BadRequestException("query params \"room\" and \"identity\" are required");
    }
    String displayName = StringUtility.hasText(name) ? name : identity;
    return new TokenResponse(BEANS.get(LiveKitTokenService.class).mintToken(room, identity, displayName));
  }
}
