import {Button, Column, Form, FormModel, GroupBox, icons, scout, StringField, Table, TableField} from '@eclipse-scout/core';
import {Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * Modal dialog to create a new group/meeting room: a name plus a checkable table of contacts to
 * invite. On OK the conversation is created via the REST API and stored in {@link createdConversation}
 * so the opener (the conversations page) can navigate to it.
 */
export class NewConversationForm extends Form {

  /** The conversation created on save, or `undefined` if the form was cancelled. */
  createdConversation: Conversation | undefined;
  protected api: MeetingApi = meetingApi;

  protected override _jsonModel(): FormModel {
    return {
      title: '${textKey:scoutkit.NewMeeting}',
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
            id: 'members',
            objectType: TableField,
            label: '${textKey:scoutkit.Invite}',
            labelVisible: false,
            gridDataHints: {h: 6, weightY: 1, fillVertical: true},
            table: {
              objectType: Table,
              checkable: true,
              headerVisible: true,
              autoResizeColumns: true,
              columns: [
                {id: 'id', objectType: Column, visible: false},
                {id: 'name', objectType: Column, text: '${textKey:scoutkit.Contact}', width: 260}
              ]
            }
          },
          {
            id: 'ok',
            objectType: Button,
            label: '${textKey:scoutkit.Create}',
            iconId: icons.GROUP_PLUS,
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
    const deferred = $.Deferred();
    const table = this._membersTable();
    this.api.contacts()
      .then(contacts => {
        table.insertRows(contacts.map(c => ({cells: [c.id, c.name]})));
        deferred.resolve();
      }, err => deferred.reject(err));
    return deferred.promise();
  }

  protected override _save(data: any): JQuery.Promise<void> {
    const deferred = $.Deferred<void>();
    const table = this._membersTable();
    const idColumn = table.columnById('id');
    const memberIds = table.checkedRows().map(r => idColumn.cellValue(r) as string);
    const title = (this.widget('name', StringField).value || '').trim() || this.session.text('scoutkit.NewMeeting');
    this.api.createConversation({type: 'group', title, memberIds})
      .then(conv => {
        this.createdConversation = conv;
        deferred.resolve();
      }, err => deferred.reject(err));
    return deferred.promise();
  }

  protected _membersTable(): Table {
    return this.widget('members', TableField).table;
  }
}
