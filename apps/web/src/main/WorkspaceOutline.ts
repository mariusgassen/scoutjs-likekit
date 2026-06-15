import {InitModelOf, Outline} from '@eclipse-scout/core';
import {ConversationTablePage} from './ConversationTablePage';
import {ContactTablePage} from './ContactTablePage';

/**
 * The single outline of the ScoutKit desktop. It provides the navigation tree with two top-level
 * pages — {@link ConversationTablePage} and {@link ContactTablePage} — each of which drills down to
 * a chat conversation in the bench. The pages are created from models here so the framework wires
 * their parent to this outline.
 */
export class WorkspaceOutline extends Outline {

  protected override _init(model: InitModelOf<this>): void {
    model.title = model.title ?? 'Workspace';
    model.nodes = model.nodes ?? [
      {objectType: ConversationTablePage, text: 'Conversations'},
      {objectType: ContactTablePage, text: 'Contacts'}
    ];
    super._init(model);
  }
}
