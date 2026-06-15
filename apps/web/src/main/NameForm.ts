import {Button, Form, FormModel, GroupBox, scout, StringField} from '@eclipse-scout/core';
import {userIdentity} from '../data/UserIdentity';

/** Small modal dialog to edit the current user's display name (stored in {@link userIdentity}). */
export class NameForm extends Form {

  protected override _jsonModel(): FormModel {
    return {
      title: '${textKey:scoutkit.YourName}',
      displayHint: Form.DisplayHint.DIALOG,
      modal: true,
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'name',
            objectType: StringField,
            label: '${textKey:scoutkit.DisplayName}',
            mandatory: true,
            maxLength: 40
          },
          {
            id: 'ok',
            objectType: Button,
            label: '${textKey:scoutkit.Save}',
            systemType: Button.SystemType.OK,
            processButton: true,
            keyStroke: 'enter'
          },
          {
            id: 'cancel',
            objectType: Button,
            label: '${textKey:Cancel}',
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
