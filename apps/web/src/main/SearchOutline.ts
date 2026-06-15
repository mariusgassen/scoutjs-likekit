import {InitModelOf, Menu, Outline, Page, scout, Tree} from '@eclipse-scout/core';
import {ConversationSearchPage} from './ConversationSearchPage';
import {ContactSearchPage} from './ContactSearchPage';
import {MessageSearchPage} from './MessageSearchPage';
import {SearchQueryForm} from './SearchQueryForm';

/**
 * The global-search outline of the ScoutKit desktop. Switched to from its outline view button, it
 * runs one shared query across the workspace and groups the matches into top-level result pages —
 * {@link ConversationSearchPage}, {@link ContactSearchPage} and {@link MessageSearchPage} — each a
 * table page that drills down into a chat conversation just like the workspace pages. A "Search…"
 * action in the outline title bar opens the {@link SearchQueryForm} to enter or refine the query.
 */
export class SearchOutline extends Outline {

  /** The current shared query; empty means "no search yet" and the result pages stay empty. */
  query = '';

  protected override _init(model: InitModelOf<this>): void {
    model.title = model.title ?? 'Search';
    model.nodes = model.nodes ?? [
      {objectType: ConversationSearchPage, text: 'Conversations'},
      {objectType: ContactSearchPage, text: 'Contacts'},
      {objectType: MessageSearchPage, text: 'Messages'}
    ];
    model.menus = model.menus ?? [
      {
        id: 'SearchMenu',
        objectType: Menu,
        text: 'Search…',
        menuTypes: [Tree.MenuType.Header],
        keyStroke: 'f3'
      }
    ];
    super._init(model);
    this.widget('SearchMenu', Menu).on('action', () => this.promptSearch());
  }

  /** Set the shared query, reflect it in the outline title and reload all result pages. */
  setQuery(query: string): void {
    this.query = query;
    this.setProperty('title', query ? `Search · ${query}` : 'Search');
    this.nodes.forEach(node => (node as Page).reloadPage());
  }

  /** Open the {@link SearchQueryForm}; on save, run the (refined) search across all result pages. */
  promptSearch(): void {
    const form = scout.create(SearchQueryForm, {parent: this, query: this.query});
    form.open();
    form.whenSave().then(() => this.setQuery(form.query || ''));
  }
}
