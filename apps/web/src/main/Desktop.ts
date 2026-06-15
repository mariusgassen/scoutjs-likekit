import {Desktop as ScoutDesktop, DesktopModel, Device, InitModelOf, Menu, scout} from '@eclipse-scout/core';
import {WorkspaceOutline} from './WorkspaceOutline';
import {NameForm} from './NameForm';
import {userIdentity} from '../data/UserIdentity';

/**
 * The ScoutKit desktop. On desktop/tablet devices it uses the default display style (navigation +
 * bench), so the {@link WorkspaceOutline} is shown in the navigation and the selected page's detail
 * form (the chat) fills the bench.
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

  protected override _jsonModel(): DesktopModel {
    let compact = Device.get().type === Device.Type.MOBILE;
    return {
      title: 'ScoutKit',
      displayStyle: compact ? ScoutDesktop.DisplayStyle.COMPACT : ScoutDesktop.DisplayStyle.DEFAULT,
      navigationVisible: true,
      benchVisible: true,
      outline: {
        objectType: WorkspaceOutline
      },
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
