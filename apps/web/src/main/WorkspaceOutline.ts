import {InitModelOf, Outline} from '@eclipse-scout/core';
import {ConversationTablePage} from './ConversationTablePage';
import {ContactTablePage} from './ContactTablePage';

/**
 * The workspace outline of the ScoutKit desktop. It provides the navigation tree with the two
 * top-level pages — {@link ConversationTablePage} and {@link ContactTablePage} — each of which
 * drills down to a chat conversation in the bench. Global search lives in a separate
 * {@link SearchOutline}, reachable from its outline view button. The pages are created from models
 * here so the framework wires their parent to this outline.
 */
export class WorkspaceOutline extends Outline {

  protected override _init(model: InitModelOf<this>): void {
    model.title = model.title ?? '${textKey:scoutkit.Workspace}';
    model.nodes = model.nodes ?? [
      {objectType: ConversationTablePage, text: '${textKey:scoutkit.Conversations}'},
      {objectType: ContactTablePage, text: '${textKey:scoutkit.Contacts}'}
    ];
    super._init(model);
  }
}
