import {App, scout} from '@eclipse-scout/core';
import {Desktop} from './main/Desktop';

scout.addObjectFactories({
  Desktop: () => new Desktop()
});

new App().init();
