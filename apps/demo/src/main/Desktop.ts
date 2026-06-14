import {Desktop as ScoutDesktop, Form, InitModelOf, scout} from '@eclipse-scout/core';
import {MainForm} from './MainForm';

export class Desktop extends ScoutDesktop {

  protected override _jsonModel(): object {
    return {
      title: 'Scout Meet · LiveKit',
      displayStyle: ScoutDesktop.DisplayStyle.BENCH
    };
  }

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    const form = scout.create(MainForm, {
      parent: this,
      displayHint: Form.DisplayHint.VIEW
    });
    form.open();
  }
}
