package org.scoutkit.meeting.data;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.config.CONFIG;
import org.eclipse.scout.rt.platform.exception.ProcessingException;
import org.h2.jdbcx.JdbcConnectionPool;
import org.scoutkit.meeting.config.MeetingProperties.DbPasswordProperty;
import org.scoutkit.meeting.config.MeetingProperties.DbUrlProperty;
import org.scoutkit.meeting.config.MeetingProperties.DbUserProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Owns the embedded H2 connection pool and creates/seeds the schema on first use. Repositories
 * obtain short-lived JDBC connections via {@link #getConnection()}.
 */
@ApplicationScoped
public class Database {

  private static final Logger LOG = LoggerFactory.getLogger(Database.class);

  private volatile JdbcConnectionPool m_pool;

  protected synchronized JdbcConnectionPool pool() {
    if (m_pool == null) {
      String url = CONFIG.getPropertyValue(DbUrlProperty.class);
      String user = CONFIG.getPropertyValue(DbUserProperty.class);
      String password = CONFIG.getPropertyValue(DbPasswordProperty.class);
      LOG.info("Opening H2 database at {}", url);
      m_pool = JdbcConnectionPool.create(url, user, password != null ? password : "");
    }
    return m_pool;
  }

  public Connection getConnection() {
    try {
      return pool().getConnection();
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not obtain a database connection", e);
    }
  }

  /** Creates the schema (idempotent) and seeds demo contacts and a default group on first run. */
  public void initSchema() {
    try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
      st.execute("CREATE TABLE IF NOT EXISTS contact ("
          + "id VARCHAR(64) PRIMARY KEY, "
          + "name VARCHAR(255) NOT NULL, "
          + "email VARCHAR(255), "
          + "status VARCHAR(32), "
          + "color VARCHAR(16))");
      st.execute("CREATE TABLE IF NOT EXISTS conversation ("
          + "id VARCHAR(64) PRIMARY KEY, "
          + "type VARCHAR(16) NOT NULL, "
          + "title VARCHAR(255), "
          + "created_ts BIGINT NOT NULL)");
      st.execute("CREATE TABLE IF NOT EXISTS conversation_member ("
          + "conversation_id VARCHAR(64) NOT NULL, "
          + "contact_id VARCHAR(64) NOT NULL, "
          + "PRIMARY KEY (conversation_id, contact_id))");
      st.execute("CREATE TABLE IF NOT EXISTS message ("
          + "id VARCHAR(64) PRIMARY KEY, "
          + "conversation_id VARCHAR(64) NOT NULL, "
          + "author VARCHAR(255) NOT NULL, "
          + "text VARCHAR(4000) NOT NULL, "
          + "created_ts BIGINT NOT NULL)");
      st.execute("CREATE INDEX IF NOT EXISTS idx_message_conv ON message(conversation_id, created_ts)");
      LOG.info("Schema ready");
      BeansSeed.seed(conn);
    }
    catch (SQLException e) {
      throw new ProcessingException("Could not initialize database schema", e);
    }
  }
}
