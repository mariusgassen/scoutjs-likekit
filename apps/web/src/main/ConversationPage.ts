import {Form, InitModelOf, PageModel, PageWithNodes, scout} from '@eclipse-scout/core';
import {ChatForm} from './ChatForm';
import {Contact, Conversation} from '../data/MeetingApi';
import {Icons} from './Icons';

export interface ConversationPageModel extends PageModel {
  /** The conversation to open (from the conversations table). */
  conversation?: Conversation;
  /** A contact whose direct conversation should be opened/created (from the contacts table). */
  contact?: Contact;
}

/**
 * Leaf outline page representing a single conversation. It has no child nodes and no detail table;
 * its {@link ChatForm} detail form fills the bench with the chat surface. Created as the child page
 * of either {@link ConversationTablePage} (carrying a {@link conversation}) or
 * {@link ContactTablePage} (carrying a {@link contact} whose DM is resolved lazily).
 */
export class ConversationPage extends PageWithNodes {
  declare model: ConversationPageModel;

  conversation!: Conversation;
  contact!: Contact;

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);
    this.leaf = true;
    this.detailTableVisible = false;
    if (!this.text) {
      this.text = this.conversation?.title || this.contact?.name || this.session.text('scoutkit.Conversation');
    }
    if (!this.iconId) {
      // A contact page resolves to a direct message; a conversation can be a DM or a meeting room.
      const direct = !!this.contact || this.conversation?.type === 'direct';
      this.iconId = direct ? Icons.USER : Icons.USERS;
    }
  }

  protected override _createDetailForm(): Form {
    return scout.create(ChatForm, {
      parent: this.outline,
      conversation: this.conversation,
      contact: this.contact
    });
  }
}
