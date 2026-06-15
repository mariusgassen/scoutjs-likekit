package org.scoutkit.meeting.data;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Seeds a small set of demo contacts and a default "General" group conversation so a fresh
 * database is immediately usable. Runs only when the contact table is empty.
 */
final class BeansSeed {

  private BeansSeed() {
  }

  private static final String[][] CONTACTS = {
      {"alice", "Alice Anderson", "alice@example.com", "online", "#e8615b"},
      {"bob", "Bob Brown", "bob@example.com", "online", "#3b82f6"},
      {"carol", "Carol Clark", "carol@example.com", "away", "#10b981"},
      {"dave", "Dave Davis", "dave@example.com", "offline", "#a855f7"},
      {"erin", "Erin Evans", "erin@example.com", "online", "#f59e0b"},
  };

  static void seed(Connection conn) throws SQLException {
    try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM contact")) {
      rs.next();
      if (rs.getInt(1) > 0) {
        return; // already seeded
      }
    }

    try (PreparedStatement ps = conn.prepareStatement(
        "INSERT INTO contact (id, name, email, status, color) VALUES (?, ?, ?, ?, ?)")) {
      for (String[] c : CONTACTS) {
        ps.setString(1, c[0]);
        ps.setString(2, c[1]);
        ps.setString(3, c[2]);
        ps.setString(4, c[3]);
        ps.setString(5, c[4]);
        ps.addBatch();
      }
      ps.executeBatch();
    }

    long now = System.currentTimeMillis();
    try (PreparedStatement ps = conn.prepareStatement(
        "INSERT INTO conversation (id, type, title, created_ts) VALUES (?, ?, ?, ?)")) {
      ps.setString(1, "general");
      ps.setString(2, "group");
      ps.setString(3, "General");
      ps.setLong(4, now);
      ps.executeUpdate();
    }
    try (PreparedStatement ps = conn.prepareStatement(
        "INSERT INTO conversation_member (conversation_id, contact_id) VALUES (?, ?)")) {
      for (String[] c : CONTACTS) {
        ps.setString(1, "general");
        ps.setString(2, c[0]);
        ps.addBatch();
      }
      ps.executeBatch();
    }
    try (PreparedStatement ps = conn.prepareStatement(
        "INSERT INTO message (id, conversation_id, author, text, created_ts) VALUES (?, ?, ?, ?, ?)")) {
      ps.setString(1, "seed-welcome");
      ps.setString(2, "general");
      ps.setString(3, "Alice Anderson");
      ps.setString(4, "Welcome to the team workspace! Start a call any time — this chat stays here afterwards.");
      ps.setLong(5, now);
      ps.executeUpdate();
    }
  }
}
