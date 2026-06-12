import {Desktop as ScoutDesktop, Form, InitModelOf, scout} from '@eclipse-scout/core';
import {MeetingForm} from './MeetingForm';

export class Desktop extends ScoutDesktop {

  protected override _jsonModel(): object {
    return {
      title: 'BSI Scout JS · LiveKit Meetings',
      displayStyle: ScoutDesktop.DisplayStyle.BENCH
    };
  }

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    const form = scout.create(MeetingForm, {
      parent: this,
      displayHint: Form.DisplayHint.VIEW
    });
    form.open();
  }
}
