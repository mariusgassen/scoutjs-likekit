package org.scoutkit.meeting.model;

/**
 * A full-text search hit: a message that matched the query, together with enough of its
 * conversation to navigate to it. {@code snippet} is a PostgreSQL {@code ts_headline} excerpt with
 * the matching terms wrapped in {@code [..]} markers.
 */
public record MessageHit(
    String messageId,
    String conversationId,
    String conversationTitle,
    String conversationType,
    int memberCount,
    String author,
    String snippet,
    long ts) {
}
