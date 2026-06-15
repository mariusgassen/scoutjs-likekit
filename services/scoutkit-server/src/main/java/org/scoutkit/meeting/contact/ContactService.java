package org.scoutkit.meeting.contact;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.exception.ProcessingException;
import org.scoutkit.meeting.data.Database;
import org.scoutkit.meeting.model.Contact;

/** Reads the workspace contact directory. */
@ApplicationScoped
public class ContactService {

  public List<Contact> list() {
    List<Contact> result = new ArrayList<>();
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "SELECT id, name, email, status, color FROM contact ORDER BY name");
        ResultSet rs = ps.executeQuery()) {
      while (rs.next()) {
        result.add(read(rs));
      }
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not list contacts", e);
    }
    return result;
  }

  public Optional<Contact> getById(String id) {
    try (Connection conn = BEANS.get(Database.class).getConnection();
        PreparedStatement ps = conn.prepareStatement(
            "SELECT id, name, email, status, color FROM contact WHERE id = ?")) {
      ps.setString(1, id);
      try (ResultSet rs = ps.executeQuery()) {
        return rs.next() ? Optional.of(read(rs)) : Optional.empty();
      }
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not read contact " + id, e);
    }
  }

  protected Contact read(ResultSet rs) throws SQLException {
    return new Contact(rs.getString("id"), rs.getString("name"), rs.getString("email"),
        rs.getString("status"), rs.getString("color"));
  }
}
