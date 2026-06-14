package org.scoutjs.likekit.meeting.conversation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.exception.ProcessingException;
import org.eclipse.scout.rt.platform.util.StringUtility;
import org.scoutjs.likekit.meeting.data.Database;
import org.scoutjs.likekit.meeting.model.Conversation;
import org.scoutjs.likekit.meeting.model.Message;
import org.scoutjs.likekit.meeting.model.NewConversation;
import org.scoutjs.likekit.meeting.model.NewMessage;

/**
 * Conversations (DMs + group/meeting chats) and their persistent messages. Chat history lives
 * here independently of any LiveKit call, so it outlives the call — including multi-person
 * meetings (the conversation id doubles as the LiveKit room name).
 */
@ApplicationScoped
public class ConversationService {

  public List<Conversation> list() {
    List<Conversation> result = new ArrayList<>();
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "SELECT id, type, title, created_ts FROM conversation");
        ResultSet rs = ps.executeQuery()) {
      while (rs.next()) {
        result.add(readConversation(conn, rs.getString("id"), rs.getString("type"),
            rs.getString("title"), rs.getLong("created_ts")));
      }
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not list conversations", e);
    }
    result.sort(Comparator.comparingLong(Conversation::lastTs).reversed());
    return result;
  }

  public Optional<Conversation> get(String id) {
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "SELECT id, type, title, created_ts FROM conversation WHERE id = ?")) {
      ps.setString(1, id);
      try (ResultSet rs = ps.executeQuery()) {
        if (!rs.next()) {
          return Optional.empty();
        }
        return Optional.of(readConversation(conn, rs.getString("id"), rs.getString("type"),
            rs.getString("title"), rs.getLong("created_ts")));
      }
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not read conversation " + id, e);
    }
  }

  public Conversation create(NewConversation req) {
    String type = StringUtility.hasText(req.type()) ? req.type() : "group";
    String id = ("direct".equals(type) ? "dm-" : "grp-") + UUID.randomUUID().toString().substring(0, 8);
    long now = System.currentTimeMillis();
    List<String> memberIds = req.memberIds() != null ? req.memberIds() : List.of();

    try (Connection conn = BEANS.get(Database.class).getConnection()) {
      try (PreparedStatement ps = conn.prepareStatement(
          "INSERT INTO conversation (id, type, title, created_ts) VALUES (?, ?, ?, ?)")) {
        ps.setString(1, id);
        ps.setString(2, type);
        ps.setString(3, req.title());
        ps.setLong(4, now);
        ps.executeUpdate();
      }
      if (!memberIds.isEmpty()) {
        try (PreparedStatement ps = conn.prepareStatement(
            "INSERT INTO conversation_member (conversation_id, contact_id) VALUES (?, ?)")) {
          for (String contactId : memberIds) {
            ps.setString(1, id);
            ps.setString(2, contactId);
            ps.addBatch();
          }
          ps.executeBatch();
        }
      }
      return readConversation(conn, id, type, req.title(), now);
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not create conversation", e);
    }
  }

  public List<Message> messages(String conversationId, long afterTs) {
    List<Message> result = new ArrayList<>();
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "SELECT id, conversation_id, author, text, created_ts FROM message "
                + "WHERE conversation_id = ? AND created_ts > ? ORDER BY created_ts ASC, id ASC")) {
      ps.setString(1, conversationId);
      ps.setLong(2, afterTs);
      try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
          result.add(new Message(rs.getString("id"), rs.getString("conversation_id"),
              rs.getString("author"), rs.getString("text"), rs.getLong("created_ts")));
        }
      }
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not load messages for " + conversationId, e);
    }
    return result;
  }

  public Message addMessage(String conversationId, NewMessage req) {
    String id = "msg-" + UUID.randomUUID();
    long now = System.currentTimeMillis();
    String author = StringUtility.hasText(req.author()) ? req.author() : "Anonymous";
    String text = req.text() != null ? req.text() : "";
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "INSERT INTO message (id, conversation_id, author, text, created_ts) VALUES (?, ?, ?, ?, ?)")) {
      ps.setString(1, id);
      ps.setString(2, conversationId);
      ps.setString(3, author);
      ps.setString(4, text);
      ps.setLong(5, now);
      ps.executeUpdate();
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not store message", e);
    }
    return new Message(id, conversationId, author, text, now);
  }

  protected Conversation readConversation(Connection conn, String id, String type, String title, long createdTs) throws SQLException {
    List<String> memberIds = new ArrayList<>();
    try (PreparedStatement ps = conn.prepareStatement(
        "SELECT contact_id FROM conversation_member WHERE conversation_id = ?")) {
      ps.setString(1, id);
      try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
          memberIds.add(rs.getString("contact_id"));
        }
      }
    }

    String lastMessage = null;
    String lastAuthor = null;
    long lastTs = createdTs;
    try (PreparedStatement ps = conn.prepareStatement(
        "SELECT author, text, created_ts FROM message WHERE conversation_id = ? "
            + "ORDER BY created_ts DESC, id DESC LIMIT 1")) {
      ps.setString(1, id);
      try (ResultSet rs = ps.executeQuery()) {
        if (rs.next()) {
          lastAuthor = rs.getString("author");
          lastMessage = rs.getString("text");
          lastTs = rs.getLong("created_ts");
        }
      }
    }

    return new Conversation(id, type, title, memberIds, memberIds.size(), lastMessage, lastAuthor, lastTs);
  }
}
