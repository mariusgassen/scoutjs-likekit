package org.scoutjs.likekit.meeting.data;

import org.eclipse.scout.rt.platform.BEANS;
import org.eclipse.scout.rt.platform.IPlatform.State;
import org.eclipse.scout.rt.platform.IPlatformListener;
import org.eclipse.scout.rt.platform.PlatformEvent;

/** Initializes the database schema once the Scout platform has started. */
public class SchemaInitializer implements IPlatformListener {

  @Override
  public void stateChanged(PlatformEvent event) {
    if (event.getState() == State.PlatformStarted) {
      BEANS.get(Database.class).initSchema();
    }
  }
}
