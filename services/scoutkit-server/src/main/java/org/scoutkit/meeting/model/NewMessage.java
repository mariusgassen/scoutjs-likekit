package org.scoutkit.meeting.model;

/** Request body for posting a chat message. */
public record NewMessage(String author, String text) {
}
