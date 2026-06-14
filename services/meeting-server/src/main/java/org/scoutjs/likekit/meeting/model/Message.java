package org.scoutjs.likekit.meeting.model;

/** A persisted chat message in a conversation. */
public record Message(String id, String conversationId, String author, String text, long ts) {
}
