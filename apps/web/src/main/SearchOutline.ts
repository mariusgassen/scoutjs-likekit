import {InitModelOf, SearchOutline as ScoutSearchOutline} from '@eclipse-scout/core';
import {ConversationSearchPage} from './ConversationSearchPage';
import {ContactSearchPage} from './ContactSearchPage';
import {MessageSearchPage} from './MessageSearchPage';
import {SearchResultPage} from './SearchResultPage';

/**
 * The global-search outline of the ScoutKit desktop. It extends Scout's {@link ScoutSearchOutline},
 * which renders the search field, clear icon, status line, debounce, validation and result
 * navigation keystrokes at the top of the navigation. We only add the workspace wiring: the shared
 * query is run by the **backend search services** and the matches are grouped into top-level result
 * pages — {@link ConversationSearchPage}, {@link ContactSearchPage} and {@link MessageSearchPage} —
 * each a table page that drills down into a chat conversation just like the workspace pages.
 */
export class SearchOutline extends ScoutSearchOutline {

  /** The current valid query driving the result pages ('' while the field is empty or too short). */
  query = '';

  protected override _init(model: InitModelOf<this>): void {
    model.title = model.title ?? 'Search';
    model.nodes = model.nodes ?? [
      {objectType: ConversationSearchPage, text: 'Conversations'},
      {objectType: ContactSearchPage, text: 'Contacts'},
      {objectType: MessageSearchPage, text: 'Messages'}
    ];
    super._init(model);
    // ScoutSearchOutline owns the field, debounce and validation; it fires 'search' with a valid
    // query and 'resetSearch' when the field is cleared or too short. Mirror that into our shared
    // query and reload every result page so the matches show in all table pages.
    this.on('search', () => this._runSearch(this.searchQuery || ''));
    this.on('resetSearch', () => this._runSearch(''));
  }

  protected _searchPages(): SearchResultPage[] {
    return this.nodes as SearchResultPage[];
  }

  protected _runSearch(query: string): void {
    if (query === this.query) {
      return;
    }
    this.query = query;
    const reloads = this._searchPages().map(page => page.loadChildren());
    if (!query) {
      return; // ScoutSearchOutline already cleared the status for the empty/too-short case
    }
    $.promiseAll(reloads).then(() => this._renderResultStatus(query));
  }

  /** Once all result pages have loaded, show the aggregated "N results for <query>" status. */
  protected _renderResultStatus(query: string): void {
    if (query !== this.query) {
      return; // a newer search has superseded this one
    }
    const pages = this._searchPages();
    const total = pages.reduce((sum, page) => sum + page.resultCount, 0);
    const limited = pages.some(page => page.limited);
    this.setSearchStatus(this.session.text('ui.NumSearchResults', limited ? total + '+' : total, query));
  }

  /** Status is managed in {@link _renderResultStatus}; suppress the base count (it has no SearchStates). */
  protected override _updateSearchStatus(): void {
    // no-op
  }
}
