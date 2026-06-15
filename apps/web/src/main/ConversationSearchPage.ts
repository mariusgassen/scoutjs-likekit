import {Column, NumberColumn, ObjectOrChildModel, Page, scout, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {SearchResultPage} from './SearchResultPage';
import {Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * {@link SearchOutline} result page matching conversations (DMs and meeting rooms) against the query
 * via the backend search service (matches the title or a member's name/email). Drilling into a row
 * opens that conversation, reusing the same {@link ConversationPage} / chat detail form as the
 * workspace.
 */
export class ConversationSearchPage extends SearchResultPage {

  protected api: MeetingApi = meetingApi;
  protected _convById = new Map<string, Conversation>();

  protected override _createColumns(): ObjectOrChildModel<Column<any>>[] {
    return [
      {id: 'id', objectType: Column, visible: false},
      {id: 'title', objectType: Column, text: 'Conversation', width: 220, summary: true},
      {id: 'type', objectType: Column, text: 'Type', width: 90},
      {id: 'lastMessage', objectType: Column, text: 'Last message', width: 320},
      {id: 'members', objectType: NumberColumn, text: 'Members', width: 90}
    ];
  }

  protected override _search(query: string): Promise<Conversation[]> {
    return this.api.searchConversations(query, this._searchLimit);
  }

  protected override _transformTableDataToTableRows(tableData: Conversation[]): Record<string, any>[] {
    this._convById.clear();
    return tableData.map(conv => {
      this._convById.set(conv.id, conv);
      const preview = conv.lastMessage
        ? `${conv.lastAuthor ? conv.lastAuthor.split(' ')[0] + ': ' : ''}${conv.lastMessage}`
        : 'No messages yet';
      return {
        cells: [
          conv.id,
          conv.title || conv.id,
          conv.type === 'direct' ? 'Direct' : 'Meeting',
          preview,
          conv.memberCount
        ]
      };
    });
  }

  protected override _createChildPage(row: TableRow): Page {
    const id = this.detailTable.columnById('id').cellValue(row) as string;
    const conversation = this._convById.get(id);
    return scout.create(ConversationPage, {parent: this.outline, conversation});
  }
}
