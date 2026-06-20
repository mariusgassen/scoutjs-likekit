package org.scoutkit.meeting.model;

/** Request body for renaming a conversation ({@code PUT /api/conversations/{id}}). */
public record RenameConversation(String title) {
}
