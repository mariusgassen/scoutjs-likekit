import {Column, icons, Menu, NumberColumn, Page, PageWithTable, scout, Table, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {NewConversationForm} from './NewConversationForm';
import {Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * Top-level outline page listing all conversations (DMs and group/meeting rooms) in a table.
 * Selecting a row drills down to the {@link ConversationPage} for that conversation; an empty-space
 * "New meeting" menu opens the {@link NewConversationForm} to create a group/meeting room.
 */
export class ConversationTablePage extends PageWithTable {

  protected api: MeetingApi = meetingApi;
  protected _convById = new Map<string, Conversation>();

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
        {id: 'id', objectType: Column, visible: false},
        {id: 'title', objectType: Column, text: '${textKey:scoutkit.Conversation}', width: 220, summary: true},
        {id: 'type', objectType: Column, text: '${textKey:scoutkit.Type}', width: 90},
        {id: 'lastMessage', objectType: Column, text: '${textKey:scoutkit.LastMessage}', width: 320},
        {id: 'members', objectType: NumberColumn, text: '${textKey:scoutkit.Members}', width: 90}
      ],
      menus: [
        {
          id: 'NewMeetingMenu',
          objectType: Menu,
          text: '${textKey:scoutkit.NewMeeting}',
          iconId: icons.GROUP_PLUS,
          menuTypes: [Table.MenuType.EmptySpace],
          keyStroke: 'insert'
        }
      ]
    });
  }

  protected override _initDetailTable(table: Table): void {
    super._initDetailTable(table);
    table.widget('NewMeetingMenu', Menu).on('action', () => this._onNewMeeting());
  }

  protected override _loadTableData(searchFilter: any): JQuery.Promise<any> {
    const deferred = $.Deferred();
    this.api.conversations().then(list => deferred.resolve(list), err => deferred.reject(err));
    return deferred.promise();
  }

  protected override _transformTableDataToTableRows(tableData: Conversation[]): Record<string, any>[] {
    this._convById.clear();
    return tableData.map(conv => {
      this._convById.set(conv.id, conv);
      const preview = conv.lastMessage
        ? `${conv.lastAuthor ? conv.lastAuthor.split(' ')[0] + ': ' : ''}${conv.lastMessage}`
        : this.session.text('scoutkit.NoMessagesYet');
      return {
        cells: [
          conv.id,
          conv.title || conv.id,
          conv.type === 'direct' ? this.session.text('scoutkit.Direct') : this.session.text('scoutkit.Meeting'),
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

  protected _onNewMeeting(): void {
    const form = scout.create(NewConversationForm, {parent: this.outline});
    form.open();
    form.whenSave().then(() => {
      const created = form.createdConversation;
      if (!created) {
        return;
      }
      this.detailTable.one('rowsInserted', () => {
        const row = this.detailTable.rows.find(r => this.detailTable.columnById('id').cellValue(r) === created.id);
        if (row) {
          this.detailTable.selectRow(row);
        }
      });
      this.reloadPage();
    });
  }
}
