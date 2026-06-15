package org.scoutkit.meeting.data;

import javax.sql.DataSource;

import org.eclipse.scout.rt.platform.ApplicationScoped;
import org.eclipse.scout.rt.platform.config.CONFIG;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.conf.Settings;
import org.jooq.impl.DSL;
import org.scoutkit.meeting.config.MeetingProperties.DbPasswordProperty;
import org.scoutkit.meeting.config.MeetingProperties.DbUrlProperty;
import org.scoutkit.meeting.config.MeetingProperties.DbUserProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

/**
 * Owns the PostgreSQL connection pool (HikariCP) and the jOOQ {@link DSLContext} repositories use
 * for type-safe SQL. The schema is owned by Flyway (see {@code db/migration}); {@link #migrate()}
 * is invoked once on platform startup by {@link SchemaInitializer}.
 */
@ApplicationScoped
public class Database {

  private static final Logger LOG = LoggerFactory.getLogger(Database.class);

  private volatile HikariDataSource m_dataSource;
  private volatile DSLContext m_dsl;

  protected DataSource dataSource() {
    if (m_dataSource == null) {
      synchronized (this) {
        if (m_dataSource == null) {
          String url = CONFIG.getPropertyValue(DbUrlProperty.class);
          HikariConfig cfg = new HikariConfig();
          cfg.setPoolName("scoutkit-pool");
          cfg.setJdbcUrl(url);
          cfg.setUsername(CONFIG.getPropertyValue(DbUserProperty.class));
          cfg.setPassword(CONFIG.getPropertyValue(DbPasswordProperty.class));
          cfg.setMaximumPoolSize(10);
          cfg.setMinimumIdle(2);
          LOG.info("Opening PostgreSQL connection pool at {}", url);
          m_dataSource = new HikariDataSource(cfg);
        }
      }
    }
    return m_dataSource;
  }

  /**
   * The shared jOOQ context. {@code renderSchema(false)} keeps generated SQL unqualified so it
   * resolves against PostgreSQL's default {@code search_path} (public).
   */
  public DSLContext db() {
    if (m_dsl == null) {
      synchronized (this) {
        if (m_dsl == null) {
          Settings settings = new Settings().withRenderSchema(false);
          m_dsl = DSL.using(dataSource(), SQLDialect.POSTGRES, settings);
        }
      }
    }
    return m_dsl;
  }

  /** Applies pending Flyway migrations (idempotent). Creates the schema and seeds demo data. */
  public void migrate() {
    Flyway.configure()
        .dataSource(dataSource())
        .load()
        .migrate();
    LOG.info("Database migrations applied");
  }
}
