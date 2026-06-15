import {Desktop as ScoutDesktop, DesktopModel, Device, InitModelOf, Menu, OutlineViewButton, scout} from '@eclipse-scout/core';
import {WorkspaceOutline} from './WorkspaceOutline';
import {SearchOutline} from './SearchOutline';
import {NameForm} from './NameForm';
import {userIdentity} from '../data/UserIdentity';

/**
 * The ScoutKit desktop. On desktop/tablet devices it uses the default display style (navigation +
 * bench). Two outlines are offered via outline view buttons in the navigation: the
 * {@link WorkspaceOutline} (conversations + contacts) and the {@link SearchOutline} (global search);
 * the selected page's detail form (the chat) fills the bench.
 *
 * On phones it switches to the {@link ScoutDesktop.DisplayStyle.COMPACT} style. This is a pure
 * Scout JS app, so there is no server-side {@code MobileDeviceTransformer} to make the desktop
 * compact for us — we pick the style from the detected device type ourselves. In compact mode the
 * desktop shows either the navigation or the bench (never both), the outline runs in breadcrumb
 * mode and embeds the detail content (so the chat is reachable from the navigation), and the header
 * tool box is moved into the navigation. See Scout's "Compact Desktop" mobile guide.
 *
 * A header menu lets the user edit their display name.
 */
export class Desktop extends ScoutDesktop {

  protected _nameMenu!: Menu;
  protected _searchOutline!: SearchOutline;

  protected override _jsonModel(): DesktopModel {
    let compact = Device.get().type === Device.Type.MOBILE;
    return {
      title: 'ScoutKit',
      displayStyle: compact ? ScoutDesktop.DisplayStyle.COMPACT : ScoutDesktop.DisplayStyle.DEFAULT,
      navigationVisible: true,
      benchVisible: true,
      menus: [
        {
          id: 'NameMenu',
          objectType: Menu
        }
      ]
    };
  }

  protected override _init(model: InitModelOf<this>): void {
    super._init(model);

    // Two outlines, switched via outline view buttons. The buttons and the active outline must share
    // the same outline instances, so they are created here rather than in the (static) json model.
    const workspaceOutline = scout.create(WorkspaceOutline, {parent: this});
    this._searchOutline = scout.create(SearchOutline, {parent: this});
    this.setProperty('viewButtons', [
      scout.create(OutlineViewButton, {parent: this, outline: workspaceOutline, text: 'Workspace', textVisible: true}),
      scout.create(OutlineViewButton, {parent: this, outline: this._searchOutline, text: 'Search', textVisible: true})
    ]);
    this.setOutline(workspaceOutline);
    // Make the search outline feel like a global-search entry point: prompt for a query the first
    // time it is activated (while still empty).
    this.on('outlineChange', () => {
      if (this.outline === this._searchOutline && !this._searchOutline.query) {
        this._searchOutline.promptSearch();
      }
    });

    this._nameMenu = this.widget('NameMenu', Menu);
    this._nameMenu.setText(this._nameMenuText());
    this._nameMenu.on('action', () => this._onEditName());
    userIdentity.onChange(() => this._nameMenu.setText(this._nameMenuText()));
  }

  protected _nameMenuText(): string {
    return this.session.text('scoutkit.You', userIdentity.displayName);
  }

  protected _onEditName(): void {
    scout.create(NameForm, {parent: this}).open();
  }
}
