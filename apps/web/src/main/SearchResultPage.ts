import {Column, ObjectOrChildModel, PageWithTable, scout, Table} from '@eclipse-scout/core';
import {SearchOutline} from './SearchOutline';

/**
 * Base class for the result pages of the {@link SearchOutline}. Each subclass searches one entity
 * type (conversations, contacts, messages) for the outline's shared query and renders the matches in
 * its detail table. The common plumbing lives here: the table shell, reading the outline's query and
 * short-circuiting an empty query, and drilling down on row click. Subclasses only provide their
 * columns, the actual search ({@link _search}), the row mapping and the child page.
 */
export abstract class SearchResultPage extends PageWithTable {

  constructor() {
    super();
    this.drillDownOnRowClick = true;
  }

  /** The owning search outline (set by the framework when the page is wired to its parent). */
  protected get searchOutline(): SearchOutline {
    return this.outline as SearchOutline;
  }

  protected override _createDetailTable(): Table {
    return scout.create(Table, {
      parent: this.outline,
      headerVisible: true,
      autoResizeColumns: true,
      columns: this._createColumns()
    });
  }

  /** Columns for this result type; cells in {@link _transformTableDataToTableRows} must match this order. */
  protected abstract _createColumns(): ObjectOrChildModel<Column<any>>[];

  protected override _loadTableData(searchFilter: any): JQuery.Promise<any> {
    const deferred = $.Deferred();
    const query = this.searchOutline.query;
    if (!query) {
      deferred.resolve([]);
      return deferred.promise();
    }
    this._search(query).then(data => deferred.resolve(data), err => deferred.reject(err));
    return deferred.promise();
  }

  /** Run the search for the given (non-empty) query and resolve with the raw result rows. */
  protected abstract _search(query: string): Promise<any[]>;

  /**
   * Case-insensitive AND match used by the client-side result pages: every whitespace-separated term
   * of the query must appear in one of the given fields.
   */
  protected _matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
    const haystack = fields.filter(Boolean).join(' ').toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
  }
}
