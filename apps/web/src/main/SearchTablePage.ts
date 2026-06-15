import {Column, DateColumn, Menu, Page, PageWithTable, scout, Table, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {SearchQueryForm} from './SearchQueryForm';
import {Conversation, MessageHit, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * Top-level outline page for PostgreSQL full-text message search. A "Search…" menu opens the
 * {@link SearchQueryForm}; the detail table then lists ranked {@link MessageHit hits} (with a
 * highlighted snippet) across all conversations. Selecting a hit drills down to the conversation
 * via a {@link ConversationPage}, reusing the same chat detail form as the other pages.
 */
export class SearchTablePage extends PageWithTable {

  protected api: MeetingApi = meetingApi;
  protected _query = '';
  protected _hitByMessageId = new Map<string, MessageHit>();

  constructor() {
    super();
    this.drillDownOnRowClick = true;
  }

  protected override _createDetailTable(): Table {
    return scout.create(Table, {
      parent: this.outline,
      headerVisible: true,
      autoResizeColumns: true,
      columns: [
        {id: 'messageId', objectType: Column, visible: false},
        {id: 'conversation', objectType: Column, text: '${textKey:scoutkit.Conversation}', width: 180},
        {id: 'author', objectType: Column, text: '${textKey:scoutkit.Author}', width: 150},
        {id: 'snippet', objectType: Column, text: '${textKey:scoutkit.Match}', width: 380, summary: true},
        {id: 'when', objectType: DateColumn, text: '${textKey:scoutkit.When}', width: 150, format: 'dd.MM.yyyy HH:mm'}
      ],
      menus: [
        {
          id: 'SearchMenu',
          objectType: Menu,
          text: '${textKey:scoutkit.SearchEllipsis}',
          menuTypes: [Table.MenuType.EmptySpace],
          keyStroke: 'f3'
        }
      ]
    });
  }

  protected override _initDetailTable(table: Table): void {
    super._initDetailTable(table);
    table.widget('SearchMenu', Menu).on('action', () => this._onSearch());
  }

  protected override _loadTableData(searchFilter: any): JQuery.Promise<any> {
    const deferred = $.Deferred();
    if (!this._query) {
      deferred.resolve([]);
      return deferred.promise();
    }
    this.api.searchMessages(this._query).then(hits => deferred.resolve(hits), err => deferred.reject(err));
    return deferred.promise();
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

  protected _onSearch(): void {
    const form = scout.create(SearchQueryForm, {parent: this.outline, query: this._query});
    form.open();
    form.whenSave().then(() => {
      this._query = form.query || '';
      this.text = this._query ? this.session.text('scoutkit.SearchTitle', this._query) : this.session.text('Search');
      this.reloadPage();
    });
  }
}
