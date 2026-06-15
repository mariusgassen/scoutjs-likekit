package org.scoutkit.meeting.app;

import java.io.IOException;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Permissive CORS for the API. In production the web app reaches the API same-origin through
 * the nginx {@code /api} proxy, but local development serves the UI from a different port.
 */
public class CorsFilter implements Filter {

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
    HttpServletRequest req = (HttpServletRequest) request;
    HttpServletResponse resp = (HttpServletResponse) response;

    String origin = req.getHeader("Origin");
    resp.setHeader("Access-Control-Allow-Origin", origin != null ? origin : "*");
    resp.setHeader("Vary", "Origin");
    resp.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    resp.setHeader("Access-Control-Max-Age", "3600");

    if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
      resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
      return;
    }
    chain.doFilter(request, response);
  }
}
