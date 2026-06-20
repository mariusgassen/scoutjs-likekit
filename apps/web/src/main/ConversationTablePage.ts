import {Column, Device, Menu, MessageBox, MessageBoxes, NumberColumn, Page, PageWithTable, scout, Status, Table, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {NewConversationForm} from './NewConversationForm';
import {RenameConversationForm} from './RenameConversationForm';
import {Icons} from './Icons';
import {Conversation, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * Top-level outline page listing all conversations (DMs and group/meeting rooms) in a table.
 * Selecting a row drills down to the {@link ConversationPage} for that conversation. The standard
 * row actions follow the Scout contacts-sample convention (see `docs/scout-notes.md` §11): a "New"
 * menu (plus-in-circle) opens the {@link NewConversationForm}, a "Rename" menu (pencil) opens the
 * {@link RenameConversationForm}, and a "Remove" menu (trash) deletes after a confirmation; each
 * mutation reloads the page and re-selects the affected row.
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
          // In the conversations context a plain "New" reads better than "New meeting"; reuse
          // Scout core's shared `New` text key rather than an app-specific one.
          id: 'NewMenu',
          objectType: Menu,
          text: '${textKey:New}',
          iconId: Icons.PLUS_CIRCLE,
          // On phones the desktop is compact and this menu renders inside the navigation breadcrumb,
          // where a verb label crowds the row — show it icon-only there (the text stays set so it is
          // still the menu's accessible name / tap tooltip). Tablet/desktop keep the label. Mirrors
          // the same `Device.Type.MOBILE` gate that drives the compact desktop in Desktop.ts.
          textVisible: Device.get().type !== Device.Type.MOBILE,
          // Available with or without a selection (contacts-sample convention): create is reachable
          // whether the user has a row selected or is clicking on empty space.
          menuTypes: [Table.MenuType.EmptySpace, Table.MenuType.SingleSelection],
          keyStroke: 'insert'
        },
        {
          // Edit action — standard pencil glyph (built into the Scout core font), single-selection.
          id: 'RenameMenu',
          objectType: Menu,
          text: '${textKey:Rename}',
          iconId: Icons.PENCIL,
          textVisible: Device.get().type !== Device.Type.MOBILE,
          menuTypes: [Table.MenuType.SingleSelection],
          keyStroke: 'f2'
        },
        {
          // Delete action — custom trash-can glyph (`scoutkit-icons`), single-selection, confirmed.
          id: 'DeleteMenu',
          objectType: Menu,
          text: '${textKey:Remove}',
          iconId: Icons.TRASH,
          textVisible: Device.get().type !== Device.Type.MOBILE,
          menuTypes: [Table.MenuType.SingleSelection],
          keyStroke: 'delete'
        }
      ]
    });
  }

  protected override _initDetailTable(table: Table): void {
    super._initDetailTable(table);
    table.widget('NewMenu', Menu).on('action', () => this._onNewMeeting());
    table.widget('RenameMenu', Menu).on('action', () => this._onRename());
    table.widget('DeleteMenu', Menu).on('action', () => this._onDelete());
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
      if (form.createdConversation) {
        this._reloadSelecting(form.createdConversation.id);
      }
    });
  }

  protected _onRename(): void {
    const conversation = this._selectedConversation();
    if (!conversation) {
      return;
    }
    const form = scout.create(RenameConversationForm, {parent: this.outline, conversation});
    form.open();
    form.whenSave().then(() => {
      if (form.updatedConversation) {
        this._reloadSelecting(form.updatedConversation.id);
      }
    });
  }

  protected _onDelete(): void {
    const conversation = this._selectedConversation();
    if (!conversation) {
      return;
    }
    MessageBoxes.createYesNo(this.outline)
      .withSeverity(Status.Severity.WARNING)
      .withHeader(this.session.text('Remove'))
      .withBody(this.session.text('scoutkit.DeleteConversationConfirm', conversation.title || conversation.id))
      .buildAndOpen()
      .then(option => {
        if (option !== MessageBox.Buttons.YES) {
          return;
        }
        this.api.deleteConversation(conversation.id)
          .then(() => this._reloadSelecting(undefined), err => this._showError(err));
      });
  }

  /** The {@link Conversation} behind the single selected row, or `undefined` if none is selected. */
  protected _selectedConversation(): Conversation | undefined {
    const row = this.detailTable.selectedRow();
    if (!row) {
      return undefined;
    }
    return this._convById.get(this.detailTable.columnById('id').cellValue(row) as string);
  }

  /**
   * Reloads the table and, once the new rows arrive, re-selects the row with the given id (shared by
   * the create/rename actions so the just-touched conversation stays selected). Pass `undefined` to
   * just reload (e.g. after a delete, where the row is gone).
   */
  protected _reloadSelecting(id: string | undefined): void {
    if (id) {
      this.detailTable.one('rowsInserted', () => {
        const row = this.detailTable.rows.find(r => this.detailTable.columnById('id').cellValue(r) === id);
        if (row) {
          this.detailTable.selectRow(row);
        }
      });
    }
    this.reloadPage();
  }

  protected _showError(err: Error): void {
    MessageBoxes.openOk(this.outline, this.session.text('scoutkit.ErrorX', err.message), Status.Severity.ERROR);
  }
}
