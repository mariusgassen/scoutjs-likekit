package org.scoutkit.meeting.config;

import org.eclipse.scout.rt.platform.config.AbstractLongConfigProperty;
import org.eclipse.scout.rt.platform.config.AbstractStringConfigProperty;

/**
 * Typed configuration properties for the meeting server. Scout validates every key present in
 * {@code config.properties} against a declared {@code IConfigProperty} bean, so all custom
 * {@code meeting.*} keys live here. Values can be overridden via environment variables.
 */
public final class MeetingProperties {

  private MeetingProperties() {
  }

  public static class LiveKitApiKeyProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.livekit.apiKey";
    }

    @Override
    public String description() {
      return "LiveKit API key used as the JWT issuer.";
    }

    @Override
    public String getDefaultValue() {
      return "devkey";
    }
  }

  public static class LiveKitApiSecretProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.livekit.apiSecret";
    }

    @Override
    public String description() {
      return "LiveKit API secret used to sign access tokens (HS256).";
    }

    @Override
    public String getDefaultValue() {
      return "secret";
    }
  }

  public static class LiveKitTokenTtlProperty extends AbstractLongConfigProperty {
    @Override
    public String getKey() {
      return "meeting.livekit.tokenTtl";
    }

    @Override
    public String description() {
      return "Access-token lifetime in seconds.";
    }

    @Override
    public Long getDefaultValue() {
      return 21600L;
    }
  }

  public static class DbUrlProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.db.url";
    }

    @Override
    public String description() {
      return "JDBC URL of the PostgreSQL database.";
    }

    @Override
    public String getDefaultValue() {
      return "jdbc:postgresql://localhost:5432/scoutkit";
    }
  }

  public static class DbUserProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.db.user";
    }

    @Override
    public String description() {
      return "Database user.";
    }

    @Override
    public String getDefaultValue() {
      return "scoutkit";
    }
  }

  public static class DbPasswordProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.db.password";
    }

    @Override
    public String description() {
      return "Database password.";
    }

    @Override
    public String getDefaultValue() {
      return "scoutkit";
    }
  }

  public static class WebRootProperty extends AbstractStringConfigProperty {
    @Override
    public String getKey() {
      return "meeting.web.root";
    }

    @Override
    public String description() {
      return "Filesystem directory of the built Scout JS web app to serve at '/'. "
          + "When empty (default) the server is API-only; set it to serve the UI and the API "
          + "from this single Scout container.";
    }

    @Override
    public String getDefaultValue() {
      return "";
    }
  }
}
