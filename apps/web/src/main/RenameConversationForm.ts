import {Button, Form, FormModel, GroupBox, StringField} from '@eclipse-scout/core';
import {Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

export interface RenameConversationFormModel extends FormModel {
  /** The conversation to rename; its current title pre-fills the field. */
  conversation?: Conversation;
}

/**
 * Small modal dialog to rename a conversation (the standard "edit" row action). Mirrors
 * {@link NameForm}: a single pre-filled, mandatory name field. On OK the new title is persisted via
 * the REST API and the updated conversation is exposed on {@link updatedConversation} so the opener
 * (the conversations page) can reload and re-select the row.
 */
export class RenameConversationForm extends Form {
  declare model: RenameConversationFormModel;

  conversation!: Conversation;
  /** The renamed conversation on save, or `undefined` if the form was cancelled. */
  updatedConversation: Conversation | undefined;
  protected api: MeetingApi = meetingApi;

  protected override _jsonModel(): FormModel {
    return {
      title: '${textKey:scoutkit.RenameConversation}',
      displayHint: Form.DisplayHint.DIALOG,
      modal: true,
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        fields: [
          {
            id: 'name',
            objectType: StringField,
            label: '${textKey:Name}',
            mandatory: true,
            maxLength: 60
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
    this.widget('name', StringField).setValue(this.conversation?.title || '');
    return $.resolvedPromise();
  }

  protected override _save(data: any): JQuery.Promise<void> {
    const deferred = $.Deferred<void>();
    const title = (this.widget('name', StringField).value || '').trim();
    this.api.renameConversation(this.conversation.id, title)
      .then(conv => {
        this.updatedConversation = conv;
        deferred.resolve();
      }, err => deferred.reject(err));
    return deferred.promise();
  }
}
