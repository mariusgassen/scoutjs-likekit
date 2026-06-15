import {Form, FormModel, GroupBox, InitModelOf, scout, WidgetField} from '@eclipse-scout/core';
import {ChatBox} from './ChatBox';
import {Contact, Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

export interface ChatFormModel extends FormModel {
  /** Open this concrete conversation (used by the conversations page). */
  conversation?: Conversation;
  /** Open (or lazily create) the direct conversation with this contact (used by the contacts page). */
  contact?: Contact;
}

/**
 * Detail form shown in the bench when a conversation (or contact) page is selected. It carries no
 * chrome of its own: the {@link ChatBox} fills the whole form. The conversation is resolved in
 * {@link _load} — directly from {@link conversation}, or by ensuring a direct conversation exists
 * for {@link contact} — so contact pages can drill straight into a DM without pre-creating it.
 */
export class ChatForm extends Form {
  declare model: ChatFormModel;

  conversation!: Conversation;
  contact!: Contact;
  protected api: MeetingApi = meetingApi;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.title = this.conversation?.title || this.contact?.name || 'Conversation';
  }

  protected override _jsonModel(): FormModel {
    return {
      rootGroupBox: {
        objectType: GroupBox,
        gridColumnCount: 1,
        cssClass: 'chat-form-box',
        borderVisible: false,
        fields: [
          {
            id: 'ChatField',
            objectType: WidgetField,
            labelVisible: false,
            statusVisible: false,
            gridDataHints: {
              h: 12,
              weightY: 1,
              fillVertical: true,
              fillHorizontal: true
            }
          }
        ]
      }
    };
  }

  protected override _load(): JQuery.Promise<any> {
    const deferred = $.Deferred();
    const resolve = this.conversation
      ? Promise.resolve(this.conversation)
      : this.api.ensureDirectConversation(this.contact);
    resolve
      .then(conversation => {
        this.conversation = conversation;
        this.setTitle(conversation.title || conversation.id);
        this.widget('ChatField', WidgetField).setFieldWidget(
          scout.create(ChatBox, {parent: this, conversation})
        );
        deferred.resolve();
      })
      .catch(err => deferred.reject(err));
    return deferred.promise();
  }
}
