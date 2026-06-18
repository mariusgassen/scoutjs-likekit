import {Column, ObjectOrChildModel, PageWithTable, scout, Table} from '@eclipse-scout/core';
import {SearchOutline} from './SearchOutline';

/**
 * Base class for the result pages of the {@link SearchOutline}. Each subclass searches one entity
 * type (conversations, contacts, messages) for the outline's shared query and renders the matches in
 * its detail table. The common plumbing lives here: the table shell, reading the outline's query and
 * short-circuiting an empty one, drilling down on row click, and tracking the last result count so
 * the outline can show an aggregated status line. Subclasses only provide their columns, the actual
 * backend search ({@link _search}), the row mapping and the child page.
 */
export abstract class SearchResultPage extends PageWithTable {

  /** Row cap requested from the backend search service; also drives the "N+" limited status. */
  protected _searchLimit = 30;
  protected _lastResultCount = 0;
  protected _lastLimited = false;

  constructor() {
    super();
    this.drillDownOnRowClick = true;
  }

  /** The owning search outline (set by the framework when the page is wired to its parent). */
  protected get searchOutline(): SearchOutline {
    return this.outline as SearchOutline;
  }

  /** Number of matches from the most recent search (for the outline status line). */
  get resultCount(): number {
    return this._lastResultCount;
  }

  /** Whether the most recent search hit the backend row cap (drives the "N+" status). */
  get limited(): boolean {
    return this._lastLimited;
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
      this._recordResult([]);
      deferred.resolve([]);
      return deferred.promise();
    }
    this._search(query).then(data => {
      this._recordResult(data);
      deferred.resolve(data);
    }, err => {
      this._recordResult([]);
      deferred.reject(err);
    });
    return deferred.promise();
  }

  protected _recordResult(data: any[]): void {
    this._lastResultCount = data.length;
    this._lastLimited = data.length >= this._searchLimit;
  }

  /** Run the backend search for the given (non-empty) query and resolve with the raw result rows. */
  protected abstract _search(query: string): Promise<any[]>;
}
