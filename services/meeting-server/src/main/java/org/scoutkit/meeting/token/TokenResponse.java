package org.scoutkit.meeting.token;

/** Response body of {@code GET /api/token}: the minted LiveKit JWT. */
public record TokenResponse(String token) {
}
