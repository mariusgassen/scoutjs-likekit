package org.scoutjs.likekit.meeting.app;

import org.eclipse.scout.rt.security.AbstractAccessControlService;
import org.eclipse.scout.rt.security.IPermissionCollection;
import org.eclipse.scout.rt.shared.user.UserId;

/**
 * Minimal {@link org.eclipse.scout.rt.security.IAccessControlService} required by the server
 * run context. This PoC has no per-user permissions (anonymous access), so no permissions are
 * loaded.
 */
public class AccessControlService extends AbstractAccessControlService<String> {

  @Override
  protected String getCurrentUserCacheKey() {
    return UserId.CURRENT.get();
  }

  @Override
  protected IPermissionCollection execLoadPermissions(String userId) {
    return null;
  }
}
