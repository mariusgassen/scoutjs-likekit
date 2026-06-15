import {Column, ObjectOrChildModel, Page, scout, TableRow} from '@eclipse-scout/core';
import {ConversationPage} from './ConversationPage';
import {SearchResultPage} from './SearchResultPage';
import {Contact, meetingApi, MeetingApi} from '../data/MeetingApi';

/**
 * {@link SearchOutline} result page matching the workspace contact directory against the query via
 * the backend search service (matches the name, email or status). Drilling into a contact opens (and
 * lazily creates) the direct conversation with them, reusing the same {@link ConversationPage} as the
 * workspace contacts page.
 */
export class ContactSearchPage extends SearchResultPage {

  protected api: MeetingApi = meetingApi;
  protected _contactById = new Map<string, Contact>();

  protected override _createColumns(): ObjectOrChildModel<Column<any>>[] {
    return [
      {id: 'id', objectType: Column, visible: false},
      {id: 'name', objectType: Column, text: 'Name', width: 200, summary: true},
      {id: 'email', objectType: Column, text: 'Email', width: 240},
      {id: 'status', objectType: Column, text: 'Status', width: 120}
    ];
  }

  protected override _search(query: string): Promise<Contact[]> {
    return this.api.searchContacts(query, this._searchLimit);
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
