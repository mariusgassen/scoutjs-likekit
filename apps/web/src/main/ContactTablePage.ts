import {Column, Page, PageWithTable, scout, Table, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {Contact, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * Top-level outline page listing the workspace contact directory in a table. Selecting a contact
 * drills down to a {@link ConversationPage}, which opens (and lazily creates) the direct
 * conversation with that contact.
 */
export class ContactTablePage extends PageWithTable {

  protected api: MeetingApi = meetingApi;
  protected _contactById = new Map<string, Contact>();

  constructor() {
    super();
    this.drillDownOnRowClick = true;
  }

  protected override _createDetailTable(): Table {
    return scout.create(Table, {
      parent: this.outline,
      headerVisible: true,
      columns: [
        {id: 'id', objectType: Column, visible: false},
        {id: 'name', objectType: Column, text: 'Name', width: 200, summary: true},
        {id: 'email', objectType: Column, text: 'Email', width: 240},
        {id: 'status', objectType: Column, text: 'Status', width: 120}
      ]
    });
  }

  protected override _loadTableData(searchFilter: any): JQuery.Promise<any> {
    const deferred = $.Deferred();
    this.api.contacts().then(list => deferred.resolve(list), err => deferred.reject(err));
    return deferred.promise();
  }

  protected override _transformTableDataToTableRows(tableData: Contact[]): Record<string, any>[] {
    this._contactById.clear();
    return tableData.map(contact => {
      this._contactById.set(contact.id, contact);
      return {
        cells: [contact.id, contact.name, contact.email, contact.status]
      };
    });
  }

  protected override _createChildPage(row: TableRow): Page {
    const id = this.detailTable.columnById('id').cellValue(row) as string;
    const contact = this._contactById.get(id);
    return scout.create(ConversationPage, {parent: this.outline, contact});
  }
}
