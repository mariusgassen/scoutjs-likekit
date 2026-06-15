package org.scoutkit.meeting.model;

import java.util.List;

/** Request body for creating a conversation. */
public record NewConversation(String type, String title, List<String> memberIds) {
}
