import {Column, DateColumn, ObjectOrChildModel, Page, scout, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {SearchResultPage} from './SearchResultPage';
import {Conversation, MessageHit, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * {@link SearchOutline} result page running PostgreSQL full-text message search server-side
 * (`websearch_to_tsquery`). The detail table lists ranked {@link MessageHit hits} with a highlighted
 * snippet across all conversations; drilling into a hit opens its conversation via a
 * {@link ConversationPage}, reusing the same chat detail form as the other pages.
 */
export class MessageSearchPage extends SearchResultPage {

  protected api: MeetingApi = meetingApi;
  protected _hitByMessageId = new Map<string, MessageHit>();

  protected override _createColumns(): ObjectOrChildModel<Column<any>>[] {
    return [
      {id: 'messageId', objectType: Column, visible: false},
      {id: 'conversation', objectType: Column, text: '${textKey:scoutkit.Conversation}', width: 180},
      {id: 'author', objectType: Column, text: '${textKey:scoutkit.Author}', width: 150},
      {id: 'snippet', objectType: Column, text: '${textKey:scoutkit.Match}', width: 380, summary: true},
      {id: 'when', objectType: DateColumn, text: '${textKey:scoutkit.When}', width: 150, format: 'dd.MM.yyyy HH:mm'}
    ];
  }

  protected override _search(query: string): Promise<MessageHit[]> {
    return this.api.searchMessages(query, this._searchLimit);
  }

  protected override _transformTableDataToTableRows(tableData: MessageHit[]): Record<string, any>[] {
    this._hitByMessageId.clear();
    return tableData.map(hit => {
      this._hitByMessageId.set(hit.messageId, hit);
      return {
        cells: [hit.messageId, hit.conversationTitle, hit.author, hit.snippet, new Date(hit.ts)]
      };
    });
  }

  protected override _createChildPage(row: TableRow): Page {
    const messageId = this.detailTable.columnById('messageId').cellValue(row) as string;
    const hit = this._hitByMessageId.get(messageId);
    const conversation: Conversation | undefined = hit && {
      id: hit.conversationId,
      type: hit.conversationType,
      title: hit.conversationTitle,
      memberIds: [],
      memberCount: hit.memberCount,
      lastMessage: null,
      lastAuthor: null,
      lastTs: hit.ts
    };
    return scout.create(ConversationPage, {parent: this.outline, conversation});
  }
}
