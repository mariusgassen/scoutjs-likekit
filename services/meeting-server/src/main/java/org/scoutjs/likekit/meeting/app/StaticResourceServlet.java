package org.scoutjs.likekit.meeting.app;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.eclipse.scout.rt.platform.config.CONFIG;
import org.eclipse.scout.rt.platform.util.StringUtility;
import org.scoutjs.likekit.meeting.config.MeetingProperties.WebRootProperty;

/**
 * Serves the built Scout JS web app from a filesystem directory at {@code /}, so the UI and the
 * REST API ({@code /api/*}) are served by this single Scout container — no separate nginx. The
 * site is plain static files ({@code index.html} + {@code config.js} at the root, hashed bundles
 * and fonts under {@code prod/}); there is no client-side path routing, so {@code /} maps to
 * {@code index.html} and every other request maps directly to a file.
 */
public class StaticResourceServlet extends HttpServlet {
  private static final long serialVersionUID = 1L;

  private transient Path m_root;

  @Override
  public void init() {
    String root = CONFIG.getPropertyValue(WebRootProperty.class);
    m_root = StringUtility.hasText(root) ? Path.of(root).toAbsolutePath().normalize() : null;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    if (m_root == null) {
      resp.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    String uri = req.getRequestURI();
    String contextPath = req.getContextPath();
    if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
      uri = uri.substring(contextPath.length());
    }
    String rel = URLDecoder.decode(uri, StandardCharsets.UTF_8);
    if (rel.isEmpty() || "/".equals(rel)) {
      rel = "/index.html";
    }

    Path file = m_root.resolve(rel.substring(1)).normalize();
    if (!file.startsWith(m_root) || !Files.isRegularFile(file)) {
      resp.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    resp.setContentType(contentType(file.getFileName().toString()));
    resp.setHeader("Cache-Control", cacheControl(rel));
    resp.setContentLengthLong(Files.size(file));
    try (OutputStream out = resp.getOutputStream()) {
      Files.copy(file, out);
    }
  }

  protected String cacheControl(String rel) {
    if (rel.startsWith("/prod/")) {
      return "public, max-age=31536000, immutable"; // hashed bundles & fonts
    }
    return "no-store"; // index.html, config.js
  }

  protected String contentType(String name) {
    int dot = name.lastIndexOf('.');
    String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
    switch (ext) {
      case "html": return "text/html; charset=utf-8";
      case "js": return "text/javascript";
      case "css": return "text/css";
      case "json": return "application/json";
      case "map": return "application/json";
      case "svg": return "image/svg+xml";
      case "woff": return "font/woff";
      case "woff2": return "font/woff2";
      case "ttf": return "font/ttf";
      case "png": return "image/png";
      case "ico": return "image/x-icon";
      case "xml": return "application/xml";
      default: return "application/octet-stream";
    }
  }
}
