package org.scoutkit.meeting.app;

import java.io.IOException;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.server.commons.authentication.AnonymousAccessController;

/**
 * Grants anonymous access to the API. This PoC has no user accounts; participants identify
 * themselves by display name only.
 */
public class RestAuthFilter implements Filter {

  private AnonymousAccessController m_anonymousAccessController;

  @Override
  public void init(FilterConfig filterConfig) {
    m_anonymousAccessController = BEANS.get(AnonymousAccessController.class)
        .init(new AnonymousAccessController.AnonymousAuthConfig()
            .withPutPrincipalOnSession(false));
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
    HttpServletRequest req = (HttpServletRequest) request;
    HttpServletResponse resp = (HttpServletResponse) response;
    if (m_anonymousAccessController.handle(req, resp, chain)) {
      return;
    }
    resp.sendError(HttpServletResponse.SC_FORBIDDEN);
  }

  @Override
  public void destroy() {
    if (m_anonymousAccessController != null) {
      m_anonymousAccessController.destroy();
    }
  }
}
