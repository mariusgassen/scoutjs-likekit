package org.scoutjs.likekit.meeting.model;

import java.util.List;

/**
 * A direct ({@code type="direct"}) or group ({@code type="group"}) conversation. Carries a
 * preview of the last message so the conversation list can render Slack/Teams-style without an
 * extra round-trip. The conversation {@code id} doubles as the LiveKit room name for calls.
 */
public record Conversation(
    String id,
    String type,
    String title,
    List<String> memberIds,
    int memberCount,
    String lastMessage,
    String lastAuthor,
    long lastTs) {
}
