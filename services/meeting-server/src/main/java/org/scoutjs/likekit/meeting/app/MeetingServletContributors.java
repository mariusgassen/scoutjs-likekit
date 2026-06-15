package org.scoutjs.likekit.meeting.app;

import org.eclipse.jetty.ee10.servlet.FilterHolder;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.eclipse.scout.rt.jetty.IServletContributor;
import org.eclipse.scout.rt.jetty.IServletFilterContributor;
import org.eclipse.scout.rt.platform.Order;
import org.eclipse.scout.rt.platform.config.CONFIG;
import org.eclipse.scout.rt.platform.util.StringUtility;
import org.eclipse.scout.rt.rest.RestApplication;
import org.eclipse.scout.rt.rest.ServletConstants;
import org.eclipse.scout.rt.server.context.HttpServerRunContextFilter;
import org.glassfish.jersey.server.ServerProperties;
import org.glassfish.jersey.servlet.ServletContainer;
import org.glassfish.jersey.servlet.ServletProperties;
import org.scoutjs.likekit.meeting.config.MeetingProperties.WebRootProperty;

/**
 * Registers the JAX-RS (Jersey) servlet for {@code /api/*} plus the CORS, anonymous-auth and
 * server-run-context filters. The Scout {@link org.eclipse.scout.rt.app.Application} launcher
 * collects all {@link IServletContributor}/{@link IServletFilterContributor} beans on startup.
 */
public final class MeetingServletContributors {

  private MeetingServletContributors() {
  }

  /** CORS so the Scout JS dev server (different origin) can call the API directly. */
  @Order(2000)
  public static class CorsFilterContributor implements IServletFilterContributor {
    @Override
    public void contribute(ServletContextHandler handler) {
      handler.addFilter(CorsFilter.class, ServletConstants.API_PATH_WITH_WILDCARD, null);
    }
  }

  /** Jersey REST servlet; {@link RestApplication} auto-discovers all {@code IRestResource} beans. */
  @Order(3000)
  public static class ApiServletContributor implements IServletContributor {
    @Override
    public void contribute(ServletContextHandler handler) {
      ServletHolder servlet = handler.addServlet(ServletContainer.class, ServletConstants.API_PATH_WITH_WILDCARD);
      servlet.setInitParameter(ServerProperties.WADL_FEATURE_DISABLE, Boolean.TRUE.toString());
      servlet.setInitParameter(ServletProperties.JAXRS_APPLICATION_CLASS, RestApplication.class.getName());
      servlet.setInitOrder(1); // load-on-startup
    }
  }

  /** Allow anonymous access (no login) to the API. */
  @Order(4000)
  public static class RestAuthFilterContributor implements IServletFilterContributor {
    @Override
    public void contribute(ServletContextHandler handler) {
      handler.addFilter(RestAuthFilter.class, ServletConstants.API_PATH_WITH_WILDCARD, null);
    }
  }

  /** Establish a (session-less) Scout server run context for each API request. */
  @Order(5000)
  public static class ApiServerRunContextFilterContributor implements IServletFilterContributor {
    @Override
    public void contribute(ServletContextHandler handler) {
      FilterHolder filter = handler.addFilter(HttpServerRunContextFilter.class, ServletConstants.API_PATH_WITH_WILDCARD, null);
      filter.setInitParameter("session", "false");
    }
  }

  /**
   * Serve the built Scout JS web app at {@code /} when {@code meeting.web.root} is set, so a single
   * Scout container serves both the UI and the API. The more specific {@code /api/*} mapping always
   * wins over this catch-all, so the API is unaffected.
   */
  @Order(6000)
  public static class StaticResourceServletContributor implements IServletContributor {
    @Override
    public void contribute(ServletContextHandler handler) {
      if (StringUtility.hasText(CONFIG.getPropertyValue(WebRootProperty.class))) {
        handler.addServlet(StaticResourceServlet.class, "/").setInitOrder(2);
      }
    }
  }
}
