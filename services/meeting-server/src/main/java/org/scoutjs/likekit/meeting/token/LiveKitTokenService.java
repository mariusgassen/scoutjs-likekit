package org.scoutjs.likekit.meeting.token;

import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.config.CONFIG;
import org.scoutjs.likekit.meeting.config.MeetingProperties.LiveKitApiKeyProperty;
import org.scoutjs.likekit.meeting.config.MeetingProperties.LiveKitApiSecretProperty;
import org.scoutjs.likekit.meeting.config.MeetingProperties.LiveKitTokenTtlProperty;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

/**
 * Mints LiveKit access tokens. A LiveKit token is a standard HS256 JWT issued by the API key
 * and signed with the API secret, carrying a {@code video} grant claim describing what the
 * participant may do in a room. This replaces the former Node {@code livekit-server-sdk} call.
 */
@ApplicationScoped
public class LiveKitTokenService {

  public String mintToken(String room, String identity, String name) {
    String apiKey = CONFIG.getPropertyValue(LiveKitApiKeyProperty.class);
    String apiSecret = CONFIG.getPropertyValue(LiveKitApiSecretProperty.class);
    long ttlSeconds = CONFIG.getPropertyValue(LiveKitTokenTtlProperty.class);

    Instant now = Instant.now();

    Map<String, Object> video = new LinkedHashMap<>();
    video.put("room", room);
    video.put("roomJoin", true);
    video.put("canPublish", true);
    video.put("canSubscribe", true);
    video.put("canPublishData", true);

    return JWT.create()
        .withIssuer(apiKey)
        .withSubject(identity)
        .withClaim("name", name)
        .withClaim("video", video)
        .withIssuedAt(Date.from(now))
        .withNotBefore(Date.from(now))
        .withExpiresAt(Date.from(now.plusSeconds(ttlSeconds)))
        .withJWTId(UUID.randomUUID().toString())
        .sign(Algorithm.HMAC256(apiSecret));
  }
}
