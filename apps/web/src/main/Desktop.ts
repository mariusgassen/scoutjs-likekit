import {Desktop as ScoutDesktop, DesktopModel, InitModelOf, Menu, scout} from '@eclipse-scout/core';
import {WorkspaceOutline} from './WorkspaceOutline';
import {NameForm} from './NameForm';
import {userIdentity} from '../data/UserIdentity';

/**
 * The ScoutKit desktop. It uses the default display style (navigation + bench), so the
 * {@link WorkspaceOutline} is shown in the navigation and the selected page's detail form (the
 * chat) fills the bench. A header menu lets the user edit their display name.
 */
export class Desktop extends ScoutDesktop {

  protected _nameMenu!: Menu;

  protected override _jsonModel(): DesktopModel {
    return {
      title: 'ScoutKit',
      displayStyle: ScoutDesktop.DisplayStyle.DEFAULT,
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
