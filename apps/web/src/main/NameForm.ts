import {Button, Form, FormModel, GroupBox, scout, StringField} from '@eclipse-scout/core';
import {userIdentity} from '../data/UserIdentity';

/** Small modal dialog to edit the current user's display name (stored in {@link userIdentity}). */
export class NameForm extends Form {

  protected override _jsonModel(): FormModel {
    return {
      title: 'Your name',
      displayHint: Form.DisplayHint.DIALOG,
      modal: true,
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'name',
            objectType: StringField,
            label: 'Display name',
            mandatory: true,
            maxLength: 40
          },
          {
            id: 'ok',
            objectType: Button,
            label: 'Save',
            systemType: Button.SystemType.OK,
            processButton: true,
            keyStroke: 'enter'
          },
          {
            id: 'cancel',
            objectType: Button,
            label: 'Cancel',
            systemType: Button.SystemType.CANCEL,
            processButton: true
          }
        ]
      }
    };
  }

  protected override _load(): JQuery.Promise<any> {
    this.widget('name', StringField).setValue(userIdentity.displayName);
    return $.resolvedPromise();
  }

  protected override _save(data: any): JQuery.Promise<void> {
    userIdentity.setDisplayName(this.widget('name', StringField).value || '');
    return $.resolvedPromise();
  }
}
